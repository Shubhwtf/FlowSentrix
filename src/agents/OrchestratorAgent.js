"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorAgent = void 0;
const WorkerAgent_1 = require("./base/WorkerAgent");
const client_1 = require("../db/client");
const bus_1 = require("../events/bus");
const MonitorAgent_1 = require("./MonitorAgent");
const HealerAgent_1 = require("./HealerAgent");
const snapshots_1 = require("../events/snapshots");
const rollback_1 = require("../events/rollback");
const ToolRegistry_1 = require("./base/ToolRegistry");
const resend_1 = require("resend");
class OrchestratorAgent {
    constructor() {
        this.listenForEvents();
    }
    listenForEvents() {
        const sub = bus_1.redisSub.duplicate();
        sub.psubscribe('run:events:*');
        sub.on('pmessage', async (_pattern, channel, message) => {
            const event = JSON.parse(message);
            const runId = channel.split(':').pop();
            if (!runId)
                return;
            if (event.type === 'HITL_RESOLVED' && event.payload) {
                const { hitlId, decision, modifiedInput, rejectionInstructions } = event.payload;
                await this.resumeAfterHitl(runId, hitlId, decision, modifiedInput, rejectionInstructions);
            }
            else if (event.type === 'REPLAY_STARTED' && event.payload) {
                const { stepIndex, correctedStrategy } = event.payload;
                await this.executeReplay(runId, stepIndex, correctedStrategy);
            }
            else if (event.type === 'HEAL_SUCCEEDED') {
                await this.resumeRun(runId);
            }
            else if (event.type === 'HITL_TRIGGERED') {
                await client_1.db.updateTable('workflow_runs')
                    .set({ status: 'REQUIRES_HITL' })
                    .where('id', '=', runId)
                    .execute();
            }
        });
    }
    async resumeAfterHitl(runId, hitlId, decision, modifiedInput, rejectionInstructions) {
        const hitlRequest = await client_1.db.selectFrom('hitl_requests')
            .selectAll()
            .where('id', '=', hitlId)
            .executeTakeFirst();
        if (!hitlRequest)
            return;
        const pausedStep = await client_1.db.selectFrom('run_steps')
            .select('step_index')
            .where('id', '=', hitlRequest.step_id)
            .executeTakeFirst();
        const pausedStepIndex = pausedStep?.step_index ?? 1;
        await client_1.db.updateTable('workflow_runs')
            .set({ status: 'RUNNING' })
            .where('id', '=', runId)
            .execute();
        await (0, bus_1.publishEvent)(runId, {
            type: 'RUN_RESUMED',
            stepIndex: pausedStepIndex,
            payload: { decision, hitlId }
        });
        if (decision === 'reject') {
            await this.resumeRunFromStep(runId, pausedStepIndex, undefined, rejectionInstructions ? [
                { role: 'user', content: `CORRECTION DIRECTIVE: ${rejectionInstructions}. Please redo this step with these new instructions.` }
            ] : undefined);
        }
        else if (decision === 'modify' && modifiedInput) {
            await this.resumeRunFromStep(runId, pausedStepIndex, modifiedInput);
        }
        else {
            await this.resumeRun(runId);
        }
    }
    async executeReplay(runId, stepIndex, correctedStrategy) {
        await (0, bus_1.publishEvent)(runId, { type: 'ROLLBACK_COMPLETED', stepIndex });
        await (0, bus_1.publishEvent)(runId, { type: 'REPLAY_STARTED', stepIndex, payload: { correctedStrategy } });
        await this.resumeRunFromStep(runId, stepIndex, undefined, [
            { role: 'user', content: `TIME-TRAVEL CORRECTION: You are replaying from step ${stepIndex}. Apply the following corrected strategy: ${correctedStrategy}` }
        ]);
    }
    async resumeRunFromStep(runId, fromStepIndex, overrideInput, extraConversationHistory) {
        const run = await client_1.db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
        if (!run)
            return;
        const workflow = await client_1.db.selectFrom('workflow_definitions').selectAll().where('id', '=', run.workflow_id).executeTakeFirst();
        if (!workflow)
            return;
        const stepsConf = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps;
        const sortedSteps = stepsConf.sort((a, b) => a.index - b.index);
        // Resume background loop instead of manual iteration
        this.executeRunLoop(runId, sortedSteps, overrideInput || {}, fromStepIndex, extraConversationHistory).catch(console.error);
    }
    async startRun(workflowId, initialPayload) {
        const workflow = await client_1.db.selectFrom('workflow_definitions')
            .selectAll()
            .where('id', '=', workflowId)
            .executeTakeFirst();
        if (!workflow)
            throw new Error('WorkflowNotFound');
        const result = await client_1.db.insertInto('workflow_runs').values({
            workflow_id: workflowId,
            status: 'RUNNING',
            trigger_payload: JSON.stringify(initialPayload),
        }).returning('id').executeTakeFirstOrThrow();
        const runId = result.id;
        await (0, bus_1.publishEvent)(runId, { type: 'RUN_STARTED', payload: { workflowId } });
        // Start proactive listeners for this run
        new MonitorAgent_1.MonitorAgent().listen(runId);
        new HealerAgent_1.HealerAgent().listen(runId);
        const stepsConf = typeof workflow.steps === 'string'
            ? JSON.parse(workflow.steps)
            : workflow.steps;
        const sortedSteps = Array.isArray(stepsConf) ? stepsConf.sort((a, b) => a.index - b.index) : [];
        // Start background loop
        this.executeRunLoop(runId, sortedSteps, initialPayload).catch(e => {
            console.error(`[OrchestratorAgent] Background run ${runId} failed`, e);
        });
        return runId;
    }
    async executeRunLoop(runId, sortedSteps, initialPayload, fromStepIndex = 1, extraHistory) {
        for (const stepDef of sortedSteps) {
            if (stepDef.index < fromStepIndex)
                continue;
            const existing = await client_1.db.selectFrom('run_steps')
                .selectAll()
                .where('run_id', '=', runId)
                .where('step_index', '=', stepDef.index)
                .executeTakeFirst();
            if (!existing) {
                await client_1.db.insertInto('run_steps').values({
                    run_id: runId,
                    step_index: stepDef.index,
                    agent_type: stepDef.agentType,
                    status: 'PENDING',
                    input: JSON.stringify(stepDef.index === 1 ? initialPayload : {}),
                }).execute();
            }
            // Explicitly set to RUNNING in DB
            await client_1.db.updateTable('run_steps')
                .set({ status: 'RUNNING' })
                .where('run_id', '=', runId)
                .where('step_index', '=', stepDef.index)
                .execute();
            await (0, bus_1.publishEvent)(runId, { type: 'STEP_STARTED', stepIndex: stepDef.index, agentType: stepDef.agentType });
            const systemPrompt = extraHistory && stepDef.index === fromStepIndex
                ? `${stepDef.systemPrompt}\n\n${extraHistory.map((m) => m.content).join('\n')}`
                : stepDef.systemPrompt;
            const worker = new WorkerAgent_1.WorkerAgent(stepDef.agentType, runId, stepDef.index, systemPrompt || 'You are an autonomous agent.', stepDef.allowedTools || [], initialPayload);
            try {
                await worker.execute();
            }
            catch (error) {
                console.error(`[OrchestratorAgent] Step ${stepDef.index} execution failed`, error);
                // Mark run as FAILED in DB
                await client_1.db.updateTable('workflow_runs')
                    .set({ status: 'FAILED' })
                    .where('id', '=', runId)
                    .execute();
                // Only notify on ops-alerts for non-confidence issues (self-healing handles confidence)
                const errorStr = error instanceof Error ? error.message : String(error);
                if (!errorStr.includes('Confidence Score')) {
                    await (0, ToolRegistry_1.executeTool)('post_slack', JSON.stringify({
                        channel: 'ops',
                        message: `🚨 *Workflow Failed*: \`${runId}\`\n*Agent*: \`${stepDef.agentType}\` at Step ${stepDef.index}\n*Error*: ${errorStr}`
                    }), { runId, stepIndex: stepDef.index });
                }
                const alertTo = process.env.ALERT_EMAIL_TO;
                if (process.env.MOCK_SMTP !== 'true' && process.env.RESEND_API_KEY && typeof alertTo === 'string' && alertTo.length > 0) {
                    try {
                        const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
                        await resend.emails.send({
                            from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
                            to: alertTo,
                            subject: `[FlowSentrix] Workflow failed (${runId})`,
                            html: `<p><strong>Run</strong>: ${runId}</p><p><strong>Step</strong>: ${stepDef.index} (${stepDef.agentType})</p><p><strong>Error</strong>: ${errorStr}</p>`
                        });
                    }
                    catch (emailError) {
                        console.error('[OrchestratorAgent] Failure alert email failed', emailError);
                    }
                }
                return; // Stop the loop and the function
            }
        }
        // If loop finishes naturally, the run SUCCEEDED
        await client_1.db.updateTable('workflow_runs')
            .set({ status: 'SUCCEEDED' })
            .where('id', '=', runId)
            .execute();
        const run = await client_1.db.selectFrom('workflow_runs').select('workflow_id').where('id', '=', runId).executeTakeFirst();
        // Notify on onboarding success
        if (run?.workflow_id === 'employee_onboarding' || run?.workflow_id === 'onboarding_pipeline') {
            await (0, ToolRegistry_1.executeTool)('post_slack', JSON.stringify({
                channel: 'onboarding',
                message: `✅ *Onboarding Successful*: \`${runId}\`\nAll steps completed. Ready for the new hire!`
            }), { runId });
        }
    }
    async resumeRun(runId) {
        const run = await client_1.db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
        if (!run)
            throw new Error('RunNotFound');
        const workflow = await client_1.db.selectFrom('workflow_definitions').selectAll().where('id', '=', run.workflow_id).executeTakeFirst();
        if (!workflow)
            throw new Error('WorkflowNotFound');
        const stepsConf = typeof workflow.steps === 'string'
            ? JSON.parse(workflow.steps)
            : workflow.steps;
        const sortedSteps = Array.isArray(stepsConf) ? stepsConf.sort((a, b) => a.index - b.index) : [];
        const lastCompletedStep = await client_1.db.selectFrom('run_steps')
            .select('step_index')
            .where('run_id', '=', runId)
            .where('status', '=', 'COMPLETED')
            .orderBy('step_index', 'desc')
            .executeTakeFirst();
        const fromIndex = lastCompletedStep ? lastCompletedStep.step_index + 1 : 1;
        console.log(`[OrchestratorAgent] Resuming run ${runId} from Step ${fromIndex}`);
        // Ensure listeners are active on resume
        new MonitorAgent_1.MonitorAgent().listen(runId);
        new HealerAgent_1.HealerAgent().listen(runId);
        this.executeRunLoop(runId, sortedSteps, typeof run.trigger_payload === 'string' ? JSON.parse(run.trigger_payload) : run.trigger_payload, fromIndex).catch(console.error);
    }
    replayFromCheckpoint(runId, snapId, correctedStrategy) {
        return (0, snapshots_1.replayFromSnapshot)(runId, snapId, correctedStrategy);
    }
    async cancelRun(runId) {
        const activeSteps = await client_1.db.selectFrom('run_steps')
            .select('step_index')
            .where('run_id', '=', runId)
            .where('status', 'not in', ['COMPLETED', 'SUCCEEDED', 'ROLLED_BACK'])
            .orderBy('step_index', 'desc')
            .execute();
        const highestActiveStep = activeSteps[0]?.step_index ?? 0;
        for (let si = highestActiveStep; si >= 1; si--) {
            await (0, rollback_1.executeRollback)(runId, si);
        }
        await client_1.db.updateTable('workflow_runs')
            .set({ status: 'CANCELLED' })
            .where('id', '=', runId)
            .execute();
        await (0, bus_1.publishEvent)(runId, {
            type: 'RUN_CANCELLED',
            payload: { stepsRolledBack: highestActiveStep }
        });
        return { stepsRolledBack: highestActiveStep };
    }
}
exports.OrchestratorAgent = OrchestratorAgent;
