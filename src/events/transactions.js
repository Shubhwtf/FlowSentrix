"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeRollbackForStep = exports.logInverseOperation = exports.getTransactionsForRollback = exports.logTransaction = void 0;
const client_1 = require("../db/client");
const bus_1 = require("./bus");
const logTransaction = async (entry) => {
    await client_1.db.insertInto('audit_log').values({
        entity_type: entry.target,
        entity_id: entry.operationType,
        event_type: 'TRANSACTION_LOG',
        actor: entry.runId,
        payload: JSON.stringify({ stepIndex: entry.stepIndex, inversePayload: entry.inversePayload }),
    }).execute();
};
exports.logTransaction = logTransaction;
const getTransactionsForRollback = async (runId, fromStepInclusive) => {
    const logs = await client_1.db.selectFrom('audit_log')
        .selectAll()
        .where('event_type', '=', 'TRANSACTION_LOG')
        .where('actor', '=', runId)
        .orderBy('timestamp', 'desc')
        .execute();
    return logs.filter(log => {
        if (!log.payload || typeof log.payload !== 'string')
            return false;
        try {
            const payload = JSON.parse(log.payload);
            return payload && payload.stepIndex >= fromStepInclusive;
        }
        catch {
            return false;
        }
    });
};
exports.getTransactionsForRollback = getTransactionsForRollback;
const logInverseOperation = async (runId, stepIndex, table, operation, primaryKey, data) => {
    let inverseOp = null;
    if (operation === 'INSERT') {
        if (!data || !data.id)
            return; // Need an ID to delete it
        inverseOp = { type: 'DELETE', table, primaryKey: { id: data.id } };
    }
    else if (operation === 'UPDATE') {
        if (!primaryKey)
            return;
        let q = client_1.db.selectFrom(table).selectAll();
        for (const key of Object.keys(primaryKey)) {
            q = q.where(key, '=', primaryKey[key]);
        }
        const currentData = await q.executeTakeFirst();
        if (currentData) {
            inverseOp = { type: 'UPDATE', table, primaryKey, data: currentData };
        }
    }
    else if (operation === 'DELETE') {
        if (!primaryKey)
            return;
        let q = client_1.db.selectFrom(table).selectAll();
        for (const key of Object.keys(primaryKey)) {
            q = q.where(key, '=', primaryKey[key]);
        }
        const currentData = await q.executeTakeFirst();
        if (currentData) {
            inverseOp = { type: 'INSERT', table, data: currentData };
        }
    }
    if (inverseOp) {
        const key = `txlog:${runId}:${stepIndex}`;
        await bus_1.redisClient.lpush(key, JSON.stringify(inverseOp));
    }
};
exports.logInverseOperation = logInverseOperation;
const executeRollbackForStep = async (runId, stepIndex) => {
    const key = `txlog:${runId}:${stepIndex}`;
    const ops = await bus_1.redisClient.lrange(key, 0, -1);
    // ops are retrieved in reverse insertion order since we used lpush. Perfect.
    for (const opStr of ops) {
        const op = JSON.parse(opStr);
        if (op.type === 'DELETE') {
            let q = client_1.db.deleteFrom(op.table);
            for (const key of Object.keys(op.primaryKey)) {
                q = q.where(key, '=', op.primaryKey[key]);
            }
            await q.execute();
        }
        else if (op.type === 'UPDATE') {
            let q = client_1.db.updateTable(op.table).set(op.data);
            for (const key of Object.keys(op.primaryKey)) {
                q = q.where(key, '=', op.primaryKey[key]);
            }
            await q.execute();
        }
        else if (op.type === 'INSERT') {
            await client_1.db.insertInto(op.table).values(op.data).execute();
        }
    }
};
exports.executeRollbackForStep = executeRollbackForStep;
