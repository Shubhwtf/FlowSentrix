import { WorkerAgent } from './base/WorkerAgent';
import { db } from '../db/client';
import { publishEvent, redisSub } from '../events/bus';
import { MonitorAgent } from './MonitorAgent';
import { HealerAgent } from './HealerAgent';
import { replayFromSnapshot } from '../events/snapshots';
import { executeRollback } from '../events/rollback';
import { executeTool } from './base/ToolRegistry';
import { Resend } from 'resend';

interface StepDefinition {
    index: number;
    agentType: string;
    systemPrompt: string;
    allowedTools: string[];
}

interface HitlResolvedPayload {
    runId: string;
    hitlId: string;
    decision: 'approve' | 'reject' | 'modify';
    modifiedInput?: Record<string, unknown>;
    rejectionInstructions?: string;
}

interface ReplayStartedPayload {
    runId: string;
    stepIndex: number;
    correctedStrategy: string;
}

export class OrchestratorAgent {
    constructor() {
        this.listenForEvents();
    }

    private listenForEvents() {
        const sub = redisSub.duplicate();
        sub.psubscribe('run:events:*');
        sub.on('pmessage', async (_pattern: string, channel: string, message: string) => {
            const event = JSON.parse(message);
            const runId = channel.split(':').pop();
            if (!runId) return;

            if (event.type === 'HITL_RESOLVED' && event.payload) {
                const { hitlId, decision, modifiedInput, rejectionInstructions } = event.payload;
                await this.resumeAfterHitl(runId, hitlId, decision, modifiedInput, rejectionInstructions);
            } else if (event.type === 'REPLAY_STARTED' && event.payload) {
                const { stepIndex, correctedStrategy } = event.payload;
                await this.executeReplay(runId, stepIndex, correctedStrategy);
            } else if (event.type === 'HEAL_SUCCEEDED') {
                await this.resumeRun(runId);
            } else if (event.type === 'HITL_TRIGGERED') {
                await db.updateTable('workflow_runs')
                    .set({ status: 'REQUIRES_HITL' })
                    .where('id', '=', runId)
                    .execute();
            }
        });
    }

    private async resumeAfterHitl(
        runId: string,
        hitlId: string,
        decision: 'approve' | 'reject' | 'modify',
        modifiedInput?: Record<string, unknown>,
        rejectionInstructions?: string
    ) {
        const hitlRequest = await db.selectFrom('hitl_requests')
            .selectAll()
            .where('id', '=', hitlId)
            .executeTakeFirst();

        if (!hitlRequest) return;

        const pausedStep = await db.selectFrom('run_steps')
            .select('step_index')
            .where('id', '=', hitlRequest.step_id)
            .executeTakeFirst();

        const pausedStepIndex = pausedStep?.step_index ?? 1;

        await db.updateTable('workflow_runs')
            .set({ status: 'RUNNING' })
            .where('id', '=', runId)
            .execute();

        await publishEvent(runId, {
            type: 'RUN_RESUMED',
            stepIndex: pausedStepIndex,
            payload: { decision, hitlId }
        });

        if (decision === 'reject') {
            await this.resumeRunFromStep(runId, pausedStepIndex, undefined, rejectionInstructions ? [
                { role: 'user' as const, content: `CORRECTION DIRECTIVE: ${rejectionInstructions}. Please redo this step with these new instructions.` }
            ] : undefined);
        } else if (decision === 'modify' && modifiedInput) {
            await this.resumeRunFromStep(runId, pausedStepIndex, modifiedInput);
        } else {
            await this.resumeRun(runId);
        }
    }

    private async executeReplay(runId: string, stepIndex: number, correctedStrategy: string) {
        await publishEvent(runId, { type: 'ROLLBACK_COMPLETED', stepIndex });
        await publishEvent(runId, { type: 'REPLAY_STARTED', stepIndex, payload: { correctedStrategy } });

        await this.resumeRunFromStep(runId, stepIndex, undefined, [
            { role: 'user' as const, content: `TIME-TRAVEL CORRECTION: You are replaying from step ${stepIndex}. Apply the following corrected strategy: ${correctedStrategy}` }
        ]);
    }

    private async resumeRunFromStep(
        runId: string,
        fromStepIndex: number,
        overrideInput?: Record<string, unknown>,
        extraConversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    ) {
        const run = await db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
        if (!run) return;

        const workflow = await db.selectFrom('workflow_definitions').selectAll().where('id', '=', run.workflow_id).executeTakeFirst();
        if (!workflow) return;

        const stepsConf: StepDefinition[] = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps as StepDefinition[];
        const sortedSteps = stepsConf.sort((a, b) => a.index - b.index);

        // Resume background loop instead of manual iteration
        this.executeRunLoop(runId, sortedSteps, overrideInput || {}, fromStepIndex, extraConversationHistory).catch(console.error);
    }

    public async startRun(workflowId: string, initialPayload: unknown): Promise<string> {
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

        // Start proactive listeners for this run
        new MonitorAgent().listen(runId);
        new HealerAgent().listen(runId);

        const stepsConf: StepDefinition[] = typeof workflow.steps === 'string'
            ? JSON.parse(workflow.steps)
            : workflow.steps as StepDefinition[];

        const sortedSteps = Array.isArray(stepsConf) ? stepsConf.sort((a, b) => a.index - b.index) : [];

        // Start background loop
        this.executeRunLoop(runId, sortedSteps, initialPayload).catch(e => {
            console.error(`[OrchestratorAgent] Background run ${runId} failed`, e);
        });

        return runId;
    }

    private async executeRunLoop(runId: string, sortedSteps: StepDefinition[], initialPayload: any, fromStepIndex: number = 1, extraHistory?: any) {
        for (const stepDef of sortedSteps) {
            if (stepDef.index < fromStepIndex) continue;

            const existing = await db.selectFrom('run_steps')
                .selectAll()
                .where('run_id', '=', runId)
                .where('step_index', '=', stepDef.index)
                .executeTakeFirst();

            if (!existing) {
                await db.insertInto('run_steps').values({
                    run_id: runId,
                    step_index: stepDef.index,
                    agent_type: stepDef.agentType,
                    status: 'PENDING',
                    input: JSON.stringify(stepDef.index === 1 ? initialPayload : {}),
                }).execute();
            }

            // Explicitly set to RUNNING in DB
            await db.updateTable('run_steps')
                .set({ status: 'RUNNING' })
                .where('run_id', '=', runId)
                .where('step_index', '=', stepDef.index)
                .execute();

            await publishEvent(runId, { type: 'STEP_STARTED', stepIndex: stepDef.index, agentType: stepDef.agentType });

            const systemPrompt = extraHistory && stepDef.index === fromStepIndex
                ? `${stepDef.systemPrompt}\n\n${extraHistory.map((m: any) => m.content).join('\n')}`
                : stepDef.systemPrompt;

            const worker = new WorkerAgent(
                stepDef.agentType,
                runId,
                stepDef.index,
                systemPrompt || 'You are an autonomous agent.',
                stepDef.allowedTools || [],
                initialPayload
            );

            try {
                await worker.execute();
            } catch (error) {
                console.error(`[OrchestratorAgent] Step ${stepDef.index} execution failed`, error);

                // Mark run as FAILED in DB
                await db.updateTable('workflow_runs')
                    .set({ status: 'FAILED' })
                    .where('id', '=', runId)
                    .execute();

                // Only notify on ops-alerts for non-confidence issues (self-healing handles confidence)
                const errorStr = error instanceof Error ? error.message : String(error);
                if (!errorStr.includes('Confidence Score')) {
                    await executeTool('post_slack', JSON.stringify({
                        channel: 'ops',
                        message: `🚨 *Workflow Failed*: \`${runId}\`\n*Agent*: \`${stepDef.agentType}\` at Step ${stepDef.index}\n*Error*: ${errorStr}`
                    }), { runId, stepIndex: stepDef.index });
                }

                const alertTo = process.env.ALERT_EMAIL_TO;
                if (process.env.MOCK_SMTP !== 'true' && process.env.RESEND_API_KEY && typeof alertTo === 'string' && alertTo.length > 0) {
                    try {
                        const resend = new Resend(process.env.RESEND_API_KEY);
                        await resend.emails.send({
                            from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
                            to: alertTo,
                            subject: `[FlowSentrix] Workflow failed (${runId})`,
                            html: `<p><strong>Run</strong>: ${runId}</p><p><strong>Step</strong>: ${stepDef.index} (${stepDef.agentType})</p><p><strong>Error</strong>: ${errorStr}</p>`
                        });
                    } catch (emailError) {
                        console.error('[OrchestratorAgent] Failure alert email failed', emailError);
                    }
                }

                return; // Stop the loop and the function
            }
        }

        // If loop finishes naturally, the run SUCCEEDED
        await db.updateTable('workflow_runs')
            .set({ status: 'SUCCEEDED' })
            .where('id', '=', runId)
            .execute();

        const run = await db.selectFrom('workflow_runs').select('workflow_id').where('id', '=', runId).executeTakeFirst();

        // Notify on onboarding success
        if (run?.workflow_id === 'employee_onboarding' || run?.workflow_id === 'onboarding_pipeline') {
            await executeTool('post_slack', JSON.stringify({
                channel: 'onboarding',
                message: `✅ *Onboarding Successful*: \`${runId}\`\nAll steps completed. Ready for the new hire!`
            }), { runId });
        }
    }

    public async resumeRun(runId: string) {
        const run = await db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
        if (!run) throw new Error('RunNotFound');

        const workflow = await db.selectFrom('workflow_definitions').selectAll().where('id', '=', run.workflow_id).executeTakeFirst();
        if (!workflow) throw new Error('WorkflowNotFound');

        const stepsConf: StepDefinition[] = typeof workflow.steps === 'string'
            ? JSON.parse(workflow.steps)
            : workflow.steps as StepDefinition[];

        const sortedSteps = Array.isArray(stepsConf) ? stepsConf.sort((a, b) => a.index - b.index) : [];

        const lastCompletedStep = await db.selectFrom('run_steps')
            .select('step_index')
            .where('run_id', '=', runId)
            .where('status', '=', 'COMPLETED')
            .orderBy('step_index', 'desc')
            .executeTakeFirst();

        const fromIndex = lastCompletedStep ? lastCompletedStep.step_index + 1 : 1;

        console.log(`[OrchestratorAgent] Resuming run ${runId} from Step ${fromIndex}`);

        // Ensure listeners are active on resume
        new MonitorAgent().listen(runId);
        new HealerAgent().listen(runId);

        this.executeRunLoop(runId, sortedSteps, typeof run.trigger_payload === 'string' ? JSON.parse(run.trigger_payload) : run.trigger_payload, fromIndex).catch(console.error);
    }

    public replayFromCheckpoint(runId: string, snapId: string, correctedStrategy: string): Promise<void> {
        return replayFromSnapshot(runId, snapId, correctedStrategy);
    }

    public async cancelRun(runId: string): Promise<{ stepsRolledBack: number }> {
        const activeSteps = await db.selectFrom('run_steps')
            .select('step_index')
            .where('run_id', '=', runId)
            .where('status', 'not in', ['COMPLETED', 'SUCCEEDED', 'ROLLED_BACK'])
            .orderBy('step_index', 'desc')
            .execute();

        const highestActiveStep = activeSteps[0]?.step_index ?? 0;

        for (let si = highestActiveStep; si >= 1; si--) {
            await executeRollback(runId, si);
        }

        await db.updateTable('workflow_runs')
            .set({ status: 'CANCELLED' })
            .where('id', '=', runId)
            .execute();

        await publishEvent(runId, {
            type: 'RUN_CANCELLED',
            payload: { stepsRolledBack: highestActiveStep }
        });

        return { stepsRolledBack: highestActiveStep };
    }
}
