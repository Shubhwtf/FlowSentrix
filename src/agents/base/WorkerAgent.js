"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerAgent = void 0;
const ContextManager_1 = require("./ContextManager");
const LLaMALoop_1 = require("./LLaMALoop");
const bus_1 = require("../../events/bus");
const client_1 = require("../../db/client");
const snapshots_1 = require("../../events/snapshots");
class WorkerAgent {
    agentType;
    runId;
    stepIndex;
    systemPrompt;
    allowedTools;
    inputPayload;
    state = 'IDLE';
    context;
    constructor(agentType, runId, stepIndex, systemPrompt, allowedTools, inputPayload) {
        this.agentType = agentType;
        this.runId = runId;
        this.stepIndex = stepIndex;
        this.systemPrompt = systemPrompt;
        this.allowedTools = allowedTools;
        this.inputPayload = inputPayload;
    }
    async transition(newState, payload) {
        console.log(`[WorkerAgent] [${this.runId.split('-')[0]}] Step ${this.stepIndex} (${this.agentType}) → ${newState}`);
        this.state = newState;
        await (0, bus_1.publishEvent)(this.runId, {
            type: `STATE_${this.state}`,
            stepIndex: this.stepIndex,
            agentType: this.agentType,
            payload
        });
    }
    async execute() {
        await this.transition('INITIALIZING');
        console.log(`[WorkerAgent] [${this.runId.split('-')[0]}] Loading context for Step ${this.stepIndex}...`);
        this.context = await (0, ContextManager_1.loadContext)(this.runId, this.stepIndex);
        console.log(`[WorkerAgent] [${this.runId.split('-')[0]}] Context loaded. Transitioning to RUNNING...`);
        await this.transition('RUNNING');
        const maxPrevChars = Math.max(300, Number(process.env.GROQ_PREV_OUTPUT_CHAR_LIMIT || '800'));
        const previousOutputs = Object.entries(this.context.previousOutputs || {})
            .slice(-3)
            .reduce((acc, [key, value]) => {
            const text = typeof value === 'string' ? value : JSON.stringify(value);
            acc[key] = text.length > maxPrevChars ? text.slice(0, maxPrevChars) : text;
            return acc;
        }, {});
        const minimizedContext = {
            workflowId: this.context.workflowId,
            runId: this.context.runId,
            stepIndex: this.context.stepIndex,
            previousOutputs
        };
        const messages = [
            { role: 'system', content: `${this.systemPrompt}\n\nCRITICAL DIRECTIVE: You MUST complete this task to the best of your ability using ONLY the provided tools and context. If no tools are available, synthesize a final answer based on the input. UNDER NO CIRCUMSTANCES should you state that you are unable to perform the task or that functions are insufficient.` },
            { role: 'system', content: `Context: ${JSON.stringify(minimizedContext).substring(0, 1600)}` },
            { role: 'user', content: `Task Input: ${JSON.stringify(this.inputPayload).substring(0, 800)}` }
        ];
        try {
            console.log(`[WorkerAgent] [${this.runId.split('-')[0]}] Requesting LLM completion...`);
            const taskType = this.agentType === 'TriageAgent' ? 'triage' : 'general';
            const { finalAnswer, conversationHistory } = await (0, LLaMALoop_1.runLLaMALoop)(messages, this.allowedTools, { runId: this.runId, stepIndex: this.stepIndex }, taskType);
            console.log(`[WorkerAgent] [${this.runId.split('-')[0]}] LLM loop finished. Answer length: ${finalAnswer.length}. Transitioning to SCORING...`);
            await this.transition('SCORING');
            const scoreWindow = Math.max(4, Number(process.env.GROQ_SCORE_HISTORY_WINDOW || '8'));
            const scoreContext = conversationHistory.slice(-scoreWindow);
            const scoreMessages = [
                ...scoreContext,
                { role: 'user', content: 'Rate the confidence of the most recent output on a scale of 0-100. Return ONLY JSON {"score":number,"reasoning":string,"suggestedFix":string|null}.' }
            ];
            const { finalAnswer: rawScoreAnswer } = await (0, LLaMALoop_1.runLLaMALoop)(scoreMessages, [], undefined, 'confidence_scoring');
            let scoreData = { score: 100, reasoning: "Default", suggestedFix: null };
            try {
                scoreData = JSON.parse(rawScoreAnswer);
            }
            catch (e) {
                console.warn("Failed to parse JSON score answer", rawScoreAnswer);
            }
            if (typeof scoreData.score !== 'number' || !Number.isFinite(scoreData.score) || scoreData.score < 1 || scoreData.score > 100) {
                scoreData = { score: 80, reasoning: 'Invalid confidence scoring response; defaulting.', suggestedFix: null };
            }
            const workflow = await client_1.db.selectFrom('workflow_definitions').selectAll().where('id', '=', this.context.workflowId).executeTakeFirst();
            let threshold = 75;
            if (workflow && workflow.confidence_thresholds) {
                const thresholds = typeof workflow.confidence_thresholds === 'string' ? JSON.parse(workflow.confidence_thresholds) : workflow.confidence_thresholds;
                threshold = thresholds[this.agentType] || thresholds['default'] || thresholds['global'] || 75;
            }
            if (scoreData.score < threshold) {
                const looksLikeJson = (() => {
                    try {
                        const parsed = JSON.parse(finalAnswer);
                        return parsed !== null && typeof parsed === 'object';
                    }
                    catch {
                        return false;
                    }
                })();
                if (looksLikeJson) {
                    scoreData = { score: 80, reasoning: 'Scorer returned low confidence for valid JSON; defaulting.', suggestedFix: null };
                }
            }
            if (scoreData.score < threshold) {
                await this.transition('FAILED', { error: `Low Confidence Score: ${scoreData.score} < ${threshold}` });
                await client_1.db.updateTable('run_steps')
                    .set({
                    output: JSON.stringify(finalAnswer),
                    confidence_score: scoreData.score,
                    llm_conversation: JSON.stringify(conversationHistory),
                    status: 'FAILED'
                })
                    .where('run_id', '=', this.runId)
                    .where('step_index', '=', this.stepIndex)
                    .execute();
                await (0, bus_1.publishEvent)(this.runId, {
                    type: 'STEP_FAILED',
                    stepIndex: this.stepIndex,
                    agentType: this.agentType,
                    payload: { error: `Low Confidence Score: ${scoreData.score} < ${threshold}`, score: scoreData.score }
                });
                throw new Error(`Low Confidence Score: ${scoreData.score} (Threshold: ${threshold})`);
            }
            await client_1.db.updateTable('run_steps')
                .set({
                output: JSON.stringify(finalAnswer),
                confidence_score: scoreData.score,
                llm_conversation: JSON.stringify(conversationHistory.slice(-Math.max(8, scoreWindow))),
                status: 'COMPLETED'
            })
                .where('run_id', '=', this.runId)
                .where('step_index', '=', this.stepIndex)
                .execute();
            await (0, bus_1.publishEvent)(this.runId, {
                type: 'STEP_OUTPUT',
                stepIndex: this.stepIndex,
                agentType: this.agentType,
                payload: { output: finalAnswer, score: scoreData.score }
            });
            // Update context memory state and save delta snapshot
            this.context.previousOutputs[this.stepIndex] = finalAnswer;
            await (0, snapshots_1.saveSnapshot)(this.runId, this.stepIndex, this.context);
            await this.transition('SUCCEEDED');
            return { output: finalAnswer, score: scoreData.score };
        }
        catch (error) {
            // Only re-transition and re-throw if it wasn't a handled failure
            if (this.state !== 'FAILED') {
                await this.transition('FAILED', { error: error.message });
                await (0, bus_1.publishEvent)(this.runId, {
                    type: 'STEP_FAILED',
                    stepIndex: this.stepIndex,
                    agentType: this.agentType,
                    payload: { error: error.message }
                });
            }
            await client_1.db.updateTable('run_steps')
                .set({
                status: 'FAILED',
                output: JSON.stringify(error?.message || String(error)),
                confidence_score: 0
            })
                .where('run_id', '=', this.runId)
                .where('step_index', '=', this.stepIndex)
                .execute();
            throw error;
        }
    }
}
exports.WorkerAgent = WorkerAgent;
