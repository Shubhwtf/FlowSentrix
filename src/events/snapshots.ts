import { compare, applyPatch, Operation } from 'fast-json-patch';
import { redisClient } from './bus';
import { db } from '../db/client';

export const saveSnapshot = async (runId: string, stepIndex: number, currentState: any) => {
    if (stepIndex === 1) {
        const stateStr = JSON.stringify(currentState);
        await redisClient.set(`snapshot:${runId}:1`, stateStr);
        await db.insertInto('snapshots').values({
            run_id: runId,
            step_index: 1,
            state: currentState,
        }).execute();
        return;
    }

    const prevStateStr = await getFullSnapshot(runId, stepIndex - 1);
    const prevState = prevStateStr ? JSON.parse(prevStateStr) : {};
    const patch = compare(prevState, currentState);

    await redisClient.set(`snapshot:${runId}:${stepIndex}`, JSON.stringify(patch));
    await db.insertInto('snapshots').values({
        run_id: runId,
        step_index: stepIndex,
        state: JSON.stringify(patch),
    }).execute();
};

export const getFullSnapshot = async (runId: string, targetStepIndex: number): Promise<string | null> => {
    const baseSnapshotStr = await redisClient.get(`snapshot:${runId}:1`);
    if (!baseSnapshotStr) return null;

    let currentState = JSON.parse(baseSnapshotStr);

    for (let i = 2; i <= targetStepIndex; i++) {
        const patchStr = await redisClient.get(`snapshot:${runId}:${i}`);
        if (patchStr) {
            const patch: Operation[] = JSON.parse(patchStr);
            currentState = applyPatch(currentState, patch).newDocument;
        }
    }

    return JSON.stringify(currentState);
};

export const replayFromSnapshot = async (runId: string, snapId: string, correctedStrategy: any) => {
    const stepIndex = parseInt(snapId.split(':').pop() || '1');
    const fullStateStr = await getFullSnapshot(runId, stepIndex);
    if (!fullStateStr) throw new Error('Snapshot not found');

    // Inject corrected strategy to the state (usually replacing the input or modifying context structure)
    const state = JSON.parse(fullStateStr);

    // We would dispatch orchestrator to resume. For now just publish the REPLAY_STARTED event
    await redisClient.publish('events', JSON.stringify({
        type: 'REPLAY_STARTED',
        runId,
        stepIndex,
        payload: { correctedStrategy }
    }));
};

