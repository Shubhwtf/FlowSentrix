import { redisSub, publishEvent, WorkflowEvent } from '../events/bus';
import { db } from '../db/client';
import { executeTool } from './base/ToolRegistry';

export class MonitorAgent {
    constructor(private readonly confidenceThreshold: number = 75) { }

    private async checkSystemicFailure(runId: string, stepIndex: number, agentType: string) {
        try {
            const run = await db.selectFrom('workflow_runs').select('workflow_id').where('id', '=', runId).executeTakeFirst();
            if (!run) return;

            // Wait, healing_events don't store workflow_id natively, we must join runs, or just store it.
            // Actually db schema for healing_events is: id, run_id, step_id, event_type, llm_diagnosis, strategies_tried, outcome, created_at.
            // Wait, step_id is a string, perhaps `${runId}:${stepIndex}`? Usually we use stepIndex. We can find all runs for this workflow.
            const relatedRuns = await db.selectFrom('workflow_runs').select('id').where('workflow_id', '=', run.workflow_id).execute();
            const runIds = relatedRuns.map(r => r.id);
            if (runIds.length === 0) return;

            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const recentHeals = await db.selectFrom('healing_events')
                .select('id')
                .where('run_id', 'in', runIds)
                .where('step_id', '=', stepIndex.toString())
                .where('created_at', '>=', twentyFourHoursAgo)
                .execute();

            if (recentHeals.length >= 3) {
                const summary = `Systemic Failure Detected: Workflow ${run.workflow_id} at Step ${stepIndex} (${agentType}) has failed ${recentHeals.length} times in the last 24 hours.`;
                await publishEvent(runId, {
                    type: 'SYSTEMIC_FAILURE_DETECTED',
                    stepIndex,
                    agentType,
                    payload: { summary, count: recentHeals.length }
                });

                await executeTool('post_slack', JSON.stringify({
                    channel: 'ops-alerts',
                    message: summary
                }));
            }
        } catch (e) {
            console.error('Systemic failure check error', e);
        }
    }

    public listen(runId: string) {
        redisSub.subscribe(`run:events:${runId}`);
        redisSub.on('message', async (channel, message) => {
            if (channel !== `run:events:${runId}`) return;
            const event: WorkflowEvent = JSON.parse(message);

            if (event.type === 'STEP_OUTPUT' && event.payload?.score !== undefined) {
                if (event.payload.score < this.confidenceThreshold) {
                    await publishEvent(runId, {
                        type: 'CONFIDENCE_LOW',
                        stepIndex: event.stepIndex,
                        agentType: event.agentType,
                        payload: { score: event.payload.score }
                    });
                    await publishEvent(runId, {
                        type: 'HEAL_REQUIRED',
                        stepIndex: event.stepIndex,
                        agentType: event.agentType,
                        payload: event.payload
                    });
                    if (event.stepIndex !== undefined && event.agentType) {
                        await this.checkSystemicFailure(runId, event.stepIndex, event.agentType);
                    }
                }
            } else if (event.type === 'STEP_FAILED') {
                await publishEvent(runId, {
                    type: 'HEAL_REQUIRED',
                    stepIndex: event.stepIndex,
                    agentType: event.agentType,
                    payload: event.payload
                });
                if (event.stepIndex !== undefined && event.agentType) {
                    await this.checkSystemicFailure(runId, event.stepIndex, event.agentType);
                }
            }
        });
    }
}
