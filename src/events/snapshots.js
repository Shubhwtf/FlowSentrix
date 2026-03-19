"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayFromSnapshot = exports.getFullSnapshot = exports.saveSnapshot = void 0;
const fast_json_patch_1 = require("fast-json-patch");
const bus_1 = require("./bus");
const client_1 = require("../db/client");
const saveSnapshot = async (runId, stepIndex, currentState) => {
    if (stepIndex === 1) {
        const stateStr = JSON.stringify(currentState);
        await bus_1.redisClient.set(`snapshot:${runId}:1`, stateStr);
        await client_1.db.insertInto('snapshots').values({
            run_id: runId,
            step_index: 1,
            state: currentState,
        }).execute();
        return;
    }
    const prevStateStr = await (0, exports.getFullSnapshot)(runId, stepIndex - 1);
    const prevState = prevStateStr ? JSON.parse(prevStateStr) : {};
    const patch = (0, fast_json_patch_1.compare)(prevState, currentState);
    await bus_1.redisClient.set(`snapshot:${runId}:${stepIndex}`, JSON.stringify(patch));
    await client_1.db.insertInto('snapshots').values({
        run_id: runId,
        step_index: stepIndex,
        state: JSON.stringify(patch),
    }).execute();
};
exports.saveSnapshot = saveSnapshot;
const getFullSnapshot = async (runId, targetStepIndex) => {
    const baseSnapshotStr = await bus_1.redisClient.get(`snapshot:${runId}:1`);
    if (!baseSnapshotStr)
        return null;
    let currentState = JSON.parse(baseSnapshotStr);
    for (let i = 2; i <= targetStepIndex; i++) {
        const patchStr = await bus_1.redisClient.get(`snapshot:${runId}:${i}`);
        if (patchStr) {
            const patch = JSON.parse(patchStr);
            currentState = (0, fast_json_patch_1.applyPatch)(currentState, patch).newDocument;
        }
    }
    return JSON.stringify(currentState);
};
exports.getFullSnapshot = getFullSnapshot;
const replayFromSnapshot = async (runId, snapId, correctedStrategy) => {
    const stepIndex = parseInt(snapId.split(':').pop() || '1');
    const fullStateStr = await (0, exports.getFullSnapshot)(runId, stepIndex);
    if (!fullStateStr)
        throw new Error('Snapshot not found');
    // Inject corrected strategy to the state (usually replacing the input or modifying context structure)
    const state = JSON.parse(fullStateStr);
    // We would dispatch orchestrator to resume. For now just publish the REPLAY_STARTED event
    await bus_1.redisClient.publish('events', JSON.stringify({
        type: 'REPLAY_STARTED',
        runId,
        stepIndex,
        payload: { correctedStrategy }
    }));
};
exports.replayFromSnapshot = replayFromSnapshot;
