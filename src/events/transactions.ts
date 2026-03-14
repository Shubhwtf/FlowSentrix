import { db } from '../db/client';

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
