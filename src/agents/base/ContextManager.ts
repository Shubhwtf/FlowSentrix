import { db } from '../../db/client';

export interface WorkflowContext {
    workflowId: string;
    runId: string;
    stepIndex: number;
    previousOutputs: Record<number, any>;
    snapshot: any;
    confidenceHistory: number[];
    llmConversationHistory: any[];
}

export const loadContext = async (runId: string, stepIndex: number): Promise<WorkflowContext> => {
    const run = await db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
    if (!run) throw new Error('RunNotFound');

    const steps = await db.selectFrom('run_steps').selectAll().where('run_id', '=', runId).orderBy('step_index', 'asc').execute();

    const previousOutputs: Record<number, any> = {};
    const confidenceHistory: number[] = [];
    const llmConversationHistory: any[] = [];

    for (const step of steps) {
        if (step.step_index < stepIndex) {
            previousOutputs[step.step_index] = step.output;
            if (step.confidence_score) confidenceHistory.push(step.confidence_score);
            if (step.llm_conversation) {
                try {
                    const parsed = typeof step.llm_conversation === 'string' ? JSON.parse(step.llm_conversation) : step.llm_conversation;
                    llmConversationHistory.push(...(parsed as any[]));
                } catch { }
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
