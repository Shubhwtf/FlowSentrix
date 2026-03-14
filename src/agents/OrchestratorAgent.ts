import { WorkerAgent } from './base/WorkerAgent';
import { db } from '../db/client';
import { publishEvent } from '../events/bus';

export class OrchestratorAgent {
    public async startRun(workflowId: string, initialPayload: any) {
        const workflow = await db.selectFrom('workflow_definitions')
            .selectAll()
            .where('id', '=', workflowId)
            .executeTakeFirst();
        if (!workflow) throw new Error('WorkflowNotFound');

        const result = await db.insertInto('workflow_runs').values({
            workflow_id: workflowId,
            status: 'RUNNING',
            trigger_payload: JSON.stringify(initialPayload),
        }).returning('id').executeTakeFirstOrThrow();
        const runId = result.id;

        await publishEvent(runId, { type: 'RUN_STARTED', payload: { workflowId } });

        let stepsConf: any[] = [];
        try {
            stepsConf = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps;
        } catch { }

        const sortedSteps = Array.isArray(stepsConf) ? stepsConf.sort((a, b) => a.index - b.index) : [];

        for (const stepDef of sortedSteps) {
            const stepIndex = stepDef.index;
            await db.insertInto('run_steps').values({
                run_id: runId,
                step_index: stepIndex,
                agent_type: stepDef.agentType,
                status: 'PENDING',
                input: JSON.stringify(stepIndex === 1 ? initialPayload : {}),
            }).execute();

            await publishEvent(runId, {
                type: 'STEP_STARTED',
                stepIndex,
                agentType: stepDef.agentType,
            });

            const worker = new WorkerAgent(
                stepDef.agentType,
                runId,
                stepIndex,
                stepDef.systemPrompt || 'You are an autonomous agent.',
                stepDef.allowedTools || [],
                initialPayload
            );

            try {
                await worker.execute();
            } catch (e) {
                break;
            }
        }
    }

    public async resumeRun(runId: string) {
        const run = await db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
        if (!run) throw new Error('RunNotFound');

        const workflow = await db.selectFrom('workflow_definitions').selectAll().where('id', '=', run.workflow_id).executeTakeFirst();
        if (!workflow) throw new Error('WorkflowNotFound');

        let stepsConf: any[] = [];
        try {
            stepsConf = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps;
        } catch { }

        const completedSteps = await db.selectFrom('run_steps')
            .select('step_index')
            .where('run_id', '=', runId)
            .where('status', 'in', ['COMPLETED', 'SUCCEEDED'])
            .execute();

        const completedIndices = new Set(completedSteps.map(s => s.step_index));
        const sortedSteps = Array.isArray(stepsConf) ? stepsConf.sort((a, b) => a.index - b.index) : [];

        for (const stepDef of sortedSteps) {
            const stepIndex = stepDef.index;
            if (completedIndices.has(stepIndex)) continue;

            const existingPending = await db.selectFrom('run_steps').selectAll().where('run_id', '=', runId).where('step_index', '=', stepIndex).executeTakeFirst();
            if (!existingPending) {
                await db.insertInto('run_steps').values({
                    run_id: runId,
                    step_index: stepIndex,
                    agent_type: stepDef.agentType,
                    status: 'PENDING',
                    input: JSON.stringify(stepIndex === 1 ? run.trigger_payload : {}),
                }).execute();
            }

            await publishEvent(runId, { type: 'STEP_STARTED', stepIndex, agentType: stepDef.agentType });

            const worker = new WorkerAgent(
                stepDef.agentType,
                runId,
                stepIndex,
                stepDef.systemPrompt || 'You are an autonomous agent.',
                stepDef.allowedTools || [],
                run.trigger_payload
            );

            try {
                await worker.execute();
            } catch (e) {
                break;
            }
        }
    }
}
