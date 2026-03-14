import { loadContext, WorkflowContext } from './ContextManager';
import { runLLaMALoop } from './LLaMALoop';
import { publishEvent } from '../../events/bus';
import { db } from '../../db/client';
import { saveSnapshot } from '../../events/snapshots';

export type AgentState = 'IDLE' | 'INITIALIZING' | 'RUNNING' | 'SCORING' | 'SUCCEEDED' | 'HEALING' | 'AWAITING_HITL' | 'ROLLED_BACK' | 'FAILED';

export class WorkerAgent {
    public state: AgentState = 'IDLE';
    public context!: WorkflowContext;

    constructor(
        public readonly agentType: string,
        public readonly runId: string,
        public readonly stepIndex: number,
        public readonly systemPrompt: string,
        public readonly allowedTools: string[],
        public readonly inputPayload: any
    ) { }

    private async transition(newState: AgentState, payload?: any) {
        this.state = newState;
        await publishEvent(this.runId, {
            type: `STATE_${this.state}`,
            stepIndex: this.stepIndex,
            agentType: this.agentType,
            payload
        });
    }

    public async execute() {
        await this.transition('INITIALIZING');
        this.context = await loadContext(this.runId, this.stepIndex);

        await this.transition('RUNNING');

        const messages = [
            { role: 'system', content: this.systemPrompt },
            { role: 'system', content: `Context: ${JSON.stringify(this.context)}` },
            { role: 'user', content: `Task Input: ${JSON.stringify(this.inputPayload)}` }
        ];

        try {
            const { finalAnswer, conversationHistory } = await runLLaMALoop(messages, this.allowedTools, { runId: this.runId, stepIndex: this.stepIndex });

            await this.transition('SCORING');
            const scoreMessages = [
                ...conversationHistory,
                { role: 'user', content: 'Rate the confidence of this output on a scale of 0-100. Return ONLY a JSON object with { "score": number, "reasoning": "string" }' }
            ];
            const { finalAnswer: rawScoreAnswer } = await runLLaMALoop(scoreMessages, []);
            let scoreData = { score: 100, reasoning: "Default" };
            try {
                const cleaned = rawScoreAnswer.replace(/```json/g, '').replace(/```/g, '');
                scoreData = JSON.parse(cleaned);
            } catch (e) {
            }

            await db.updateTable('run_steps')
                .set({
                    output: JSON.stringify(finalAnswer),
                    confidence_score: scoreData.score,
                    llm_conversation: JSON.stringify(conversationHistory),
                    status: 'COMPLETED'
                })
                .where('run_id', '=', this.runId)
                .where('step_index', '=', this.stepIndex)
                .execute();

            await publishEvent(this.runId, {
                type: 'STEP_OUTPUT',
                stepIndex: this.stepIndex,
                agentType: this.agentType,
                payload: { output: finalAnswer, score: scoreData.score }
            });

            // Update context memory state and save delta snapshot
            this.context.previousOutputs[this.stepIndex] = finalAnswer;
            await saveSnapshot(this.runId, this.stepIndex, this.context);

            await this.transition('SUCCEEDED');
            return { output: finalAnswer, score: scoreData.score };
        } catch (error: any) {
            await this.transition('FAILED', { error: error.message });
            await publishEvent(this.runId, {
                type: 'STEP_FAILED',
                stepIndex: this.stepIndex,
                agentType: this.agentType,
                payload: { error: error.message }
            });
            throw error;
        }
    }
}
