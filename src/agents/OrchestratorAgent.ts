import { WorkerAgent } from './base/WorkerAgent';
import { db } from '../db/client';
import { publishEvent, redisSub } from '../events/bus';
import { MonitorAgent } from './MonitorAgent';
import { HealerAgent } from './HealerAgent';
import { replayFromSnapshot } from '../events/snapshots';
import { executeRollback } from '../events/rollback';

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
        this.listenForHitlResolved();
        this.listenForReplayStarted();
        this.listenForHealSucceeded();
        this.listenForHitlTriggered();
    }

    private listenForHitlResolved() {
        const hitlSub = redisSub.duplicate();
        hitlSub.psubscribe('run:events:*');
        hitlSub.on('pmessage', async (_pattern: string, _channel: string, message: string) => {
            const event = JSON.parse(message) as { type: string; payload?: HitlResolvedPayload };
            if (event.type !== 'HITL_RESOLVED' || !event.payload) return;
            const { runId, hitlId, decision, modifiedInput, rejectionInstructions } = event.payload;
            await this.resumeAfterHitl(runId, hitlId, decision, modifiedInput, rejectionInstructions);
        });
    }

    private listenForReplayStarted() {
        const replaySub = redisSub.duplicate();
        replaySub.psubscribe('run:events:*');
        replaySub.on('pmessage', async (_pattern: string, _channel: string, message: string) => {
            const event = JSON.parse(message) as { type: string; payload?: ReplayStartedPayload };
            if (event.type !== 'REPLAY_STARTED' || !event.payload) return;
            const { runId, stepIndex, correctedStrategy } = event.payload;
            await this.executeReplay(runId, stepIndex, correctedStrategy);
        });
    }

    private listenForHealSucceeded() {
        const healSub = redisSub.duplicate();
        healSub.psubscribe('run:events:*');
        healSub.on('pmessage', async (_pattern: string, channel: string, message: string) => {
            const event = JSON.parse(message) as { type: string };
            if (event.type !== 'HEAL_SUCCEEDED') return;
            const runId = channel.split(':').pop();
            if (runId) {
                await this.resumeRun(runId);
            }
        });
    }

    private listenForHitlTriggered() {
        const triggerSub = redisSub.duplicate();
        triggerSub.psubscribe('run:events:*');
        triggerSub.on('pmessage', async (_pattern: string, channel: string, message: string) => {
            const event = JSON.parse(message) as { type: string; payload?: any };
            if (event.type !== 'HITL_TRIGGERED') return;
            const runId = channel.split(':').pop();
            if (runId) {
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

        const pausedStepIndex = parseInt(hitlRequest.step_id, 10);

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

        new MonitorAgent().listen(runId);
        new HealerAgent().listen(runId);

        for (const stepDef of sortedSteps) {
            if (stepDef.index < fromStepIndex) continue;

            const triggerPayload = typeof run.trigger_payload === 'string'
                ? JSON.parse(run.trigger_payload)
                : run.trigger_payload;

            const effectiveInput = stepDef.index === fromStepIndex && overrideInput
                ? overrideInput
                : triggerPayload;

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
                    input: JSON.stringify(effectiveInput),
                }).execute();
            } else {
                await db.updateTable('run_steps')
                    .set({ status: 'PENDING', input: JSON.stringify(effectiveInput) })
                    .where('id', '=', existing.id)
                    .execute();
            }

            await publishEvent(runId, { type: 'STEP_STARTED', stepIndex: stepDef.index, agentType: stepDef.agentType });

            const systemPromptWithContext = extraConversationHistory && stepDef.index === fromStepIndex
                ? `${stepDef.systemPrompt || 'You are an autonomous agent.'}\n\n${extraConversationHistory.map(m => m.content).join('\n')}`
                : stepDef.systemPrompt || 'You are an autonomous agent.';

            const worker = new WorkerAgent(
                stepDef.agentType,
                runId,
                stepDef.index,
                systemPromptWithContext,
                stepDef.allowedTools || [],
                effectiveInput
            );

            try {
                await worker.execute();
            } catch {
                break;
            }
        }
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

        new MonitorAgent().listen(runId);
        new HealerAgent().listen(runId);

        await publishEvent(runId, { type: 'RUN_STARTED', payload: { workflowId } });

        const stepsConf: StepDefinition[] = typeof workflow.steps === 'string'
            ? JSON.parse(workflow.steps)
            : workflow.steps as StepDefinition[];

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

            await publishEvent(runId, { type: 'STEP_STARTED', stepIndex, agentType: stepDef.agentType });

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
            } catch {
                break;
            }
        }

        return runId;
    }

    public async resumeRun(runId: string) {
        const run = await db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
        if (!run) throw new Error('RunNotFound');

        new MonitorAgent().listen(runId);
        new HealerAgent().listen(runId);

        const workflow = await db.selectFrom('workflow_definitions').selectAll().where('id', '=', run.workflow_id).executeTakeFirst();
        if (!workflow) throw new Error('WorkflowNotFound');

        const stepsConf: StepDefinition[] = typeof workflow.steps === 'string'
            ? JSON.parse(workflow.steps)
            : workflow.steps as StepDefinition[];

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

            const triggerPayload = typeof run.trigger_payload === 'string'
                ? JSON.parse(run.trigger_payload)
                : run.trigger_payload;

            const existingPending = await db.selectFrom('run_steps').selectAll()
                .where('run_id', '=', runId)
                .where('step_index', '=', stepIndex)
                .executeTakeFirst();

            if (!existingPending) {
                await db.insertInto('run_steps').values({
                    run_id: runId,
                    step_index: stepIndex,
                    agent_type: stepDef.agentType,
                    status: 'PENDING',
                    input: JSON.stringify(stepIndex === 1 ? triggerPayload : {}),
                }).execute();
            }

            await publishEvent(runId, { type: 'STEP_STARTED', stepIndex, agentType: stepDef.agentType });

            const worker = new WorkerAgent(
                stepDef.agentType,
                runId,
                stepIndex,
                stepDef.systemPrompt || 'You are an autonomous agent.',
                stepDef.allowedTools || [],
                triggerPayload
            );

            try {
                await worker.execute();
            } catch {
                break;
            }
        }
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
