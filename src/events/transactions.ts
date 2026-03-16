import { db } from '../db/client';
import { redisClient } from './bus';

export interface TransactionLogEntry {
    runId: string;
    stepIndex: number;
    operationType: string;
    target: string;
    inversePayload: any;
}

export const logTransaction = async (entry: TransactionLogEntry) => {
    await db.insertInto('audit_log').values({
        entity_type: entry.target,
        entity_id: entry.operationType,
        event_type: 'TRANSACTION_LOG',
        actor: entry.runId,
        payload: JSON.stringify({ stepIndex: entry.stepIndex, inversePayload: entry.inversePayload }),
    }).execute();
};

export const getTransactionsForRollback = async (runId: string, fromStepInclusive: number) => {
    const logs = await db.selectFrom('audit_log')
        .selectAll()
        .where('event_type', '=', 'TRANSACTION_LOG')
        .where('actor', '=', runId)
        .orderBy('timestamp', 'desc')
        .execute();

    return logs.filter(log => {
        if (!log.payload || typeof log.payload !== 'string') return false;
        try {
            const payload = JSON.parse(log.payload) as { stepIndex: number };
            return payload && payload.stepIndex >= fromStepInclusive;
        } catch {
            return false;
        }
    });
};

export const logInverseOperation = async (runId: string, stepIndex: number, table: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', primaryKey: any, data: any) => {
    let inverseOp: any = null;

    if (operation === 'INSERT') {
        if (!data || !data.id) return; // Need an ID to delete it
        inverseOp = { type: 'DELETE', table, primaryKey: { id: data.id } };
    } else if (operation === 'UPDATE') {
        if (!primaryKey) return;
        let q = db.selectFrom(table as any).selectAll();
        for (const key of Object.keys(primaryKey)) {
            q = q.where(key as any, '=', primaryKey[key]);
        }
        const currentData = await q.executeTakeFirst();
        if (currentData) {
            inverseOp = { type: 'UPDATE', table, primaryKey, data: currentData };
        }
    } else if (operation === 'DELETE') {
        if (!primaryKey) return;
        let q = db.selectFrom(table as any).selectAll();
        for (const key of Object.keys(primaryKey)) {
            q = q.where(key as any, '=', primaryKey[key]);
        }
        const currentData = await q.executeTakeFirst();
        if (currentData) {
            inverseOp = { type: 'INSERT', table, data: currentData };
        }
    }

    if (inverseOp) {
        const key = `txlog:${runId}:${stepIndex}`;
        await redisClient.lpush(key, JSON.stringify(inverseOp));
    }
};

export const executeRollbackForStep = async (runId: string, stepIndex: number) => {
    const key = `txlog:${runId}:${stepIndex}`;
    const ops = await redisClient.lrange(key, 0, -1);

    // ops are retrieved in reverse insertion order since we used lpush. Perfect.
    for (const opStr of ops) {
        const op = JSON.parse(opStr);
        if (op.type === 'DELETE') {
            let q = db.deleteFrom(op.table as any);
            for (const key of Object.keys(op.primaryKey)) {
                q = q.where(key as any, '=', op.primaryKey[key]);
            }
            await q.execute();
        } else if (op.type === 'UPDATE') {
            let q = db.updateTable(op.table as any).set(op.data);
            for (const key of Object.keys(op.primaryKey)) {
                q = q.where(key as any, '=', op.primaryKey[key]);
            }
            await q.execute();
        } else if (op.type === 'INSERT') {
            await db.insertInto(op.table as any).values(op.data).execute();
        }
    }
};
