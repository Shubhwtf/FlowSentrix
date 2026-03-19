"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadContext = void 0;
const client_1 = require("../../db/client");
const loadContext = async (runId, stepIndex) => {
    const run = await client_1.db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
    if (!run)
        throw new Error('RunNotFound');
    const steps = await client_1.db.selectFrom('run_steps').selectAll().where('run_id', '=', runId).orderBy('step_index', 'asc').execute();
    const previousOutputs = {};
    const confidenceHistory = [];
    const llmConversationHistory = [];
    for (const step of steps) {
        if (step.step_index < stepIndex) {
            previousOutputs[step.step_index] = step.output;
            if (step.confidence_score)
                confidenceHistory.push(step.confidence_score);
            if (step.llm_conversation) {
                try {
                    const parsed = typeof step.llm_conversation === 'string' ? JSON.parse(step.llm_conversation) : step.llm_conversation;
                    llmConversationHistory.push(...parsed);
                }
                catch { }
            }
        }
    }
    return {
        workflowId: run.workflow_id,
        runId,
        stepIndex,
        previousOutputs,
        snapshot: {},
        confidenceHistory,
        llmConversationHistory,
    };
};
exports.loadContext = loadContext;
