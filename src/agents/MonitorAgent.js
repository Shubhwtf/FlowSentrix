"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitorAgent = void 0;
const bus_1 = require("../events/bus");
const client_1 = require("../db/client");
const ToolRegistry_1 = require("./base/ToolRegistry");
const activeMonitorRuns = new Set();
const systemicFailureCooldownMs = 10 * 60 * 1000;
const lastSystemicFailureAt = new Map();
class MonitorAgent {
    confidenceThreshold;
    constructor(confidenceThreshold = 75) {
        this.confidenceThreshold = confidenceThreshold;
    }
    async checkSystemicFailure(runId, stepIndex, agentType) {
        try {
            const run = await client_1.db.selectFrom('workflow_runs').select('workflow_id').where('id', '=', runId).executeTakeFirst();
            if (!run)
                return;
            const relatedRuns = await client_1.db.selectFrom('workflow_runs').select('id').where('workflow_id', '=', run.workflow_id).execute();
            const runIds = relatedRuns.map(r => r.id);
            if (runIds.length === 0)
                return;
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentEscalations = await client_1.db.selectFrom('healing_events')
                .innerJoin('run_steps', 'run_steps.id', 'healing_events.step_id')
                .select('healing_events.id')
                .where('healing_events.run_id', 'in', runIds)
                .where('run_steps.step_index', '=', stepIndex)
                .where('healing_events.outcome', '=', 'ESCALATED_HITL')
                .where('healing_events.created_at', '>=', twentyFourHoursAgo)
                .execute();
            if (recentEscalations.length >= 3) {
                const key = `${run.workflow_id}:${stepIndex}:${agentType}`;
                const lastAt = lastSystemicFailureAt.get(key) || 0;
                const now = Date.now();
                if (now - lastAt < systemicFailureCooldownMs)
                    return;
                lastSystemicFailureAt.set(key, now);
                const summary = `Systemic Failure Detected: Workflow ${run.workflow_id} at Step ${stepIndex} (${agentType}) has escalated to HITL ${recentEscalations.length} times in the last 24 hours.`;
                await (0, bus_1.publishEvent)(runId, {
                    type: 'SYSTEMIC_FAILURE_DETECTED',
                    stepIndex,
                    agentType,
                    payload: { summary, count: recentEscalations.length }
                });
                await (0, ToolRegistry_1.executeTool)('post_slack', JSON.stringify({
                    channel: 'ops',
                    message: summary
                }));
            }
        }
        catch (e) {
            console.error('Systemic failure check error', e);
        }
    }
    listen(runId) {
        if (activeMonitorRuns.has(runId))
            return;
        activeMonitorRuns.add(runId);
        const sub = bus_1.redisSub.duplicate();
        sub.subscribe(`run:events:${runId}`);
        sub.on('message', async (channel, message) => {
            if (channel !== `run:events:${runId}`)
                return;
            const event = JSON.parse(message);
            console.log(`[MonitorAgent] [${runId}] Received event: ${event.type}`);
            if (event.type === 'STEP_OUTPUT' && event.payload?.score !== undefined) {
                if (event.payload.score < this.confidenceThreshold) {
                    await (0, bus_1.publishEvent)(runId, {
                        type: 'CONFIDENCE_LOW',
                        stepIndex: event.stepIndex,
                        agentType: event.agentType,
                        payload: { score: event.payload.score }
                    });
                    await (0, bus_1.publishEvent)(runId, {
                        type: 'HEAL_REQUIRED',
                        stepIndex: event.stepIndex,
                        agentType: event.agentType,
                        payload: event.payload
                    });
                    if (event.stepIndex !== undefined && event.agentType) {
                        await this.checkSystemicFailure(runId, event.stepIndex, event.agentType);
                    }
                }
            }
            if (event.type === 'STEP_FAILED' && event.stepIndex !== undefined) {
                await (0, bus_1.publishEvent)(runId, {
                    type: 'HEAL_REQUIRED',
                    stepIndex: event.stepIndex,
                    agentType: event.agentType,
                    payload: event.payload
                });
                if (event.agentType) {
                    await this.checkSystemicFailure(runId, event.stepIndex, event.agentType);
                }
            }
        });
    }
}
exports.MonitorAgent = MonitorAgent;
