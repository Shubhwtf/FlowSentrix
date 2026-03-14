import { db } from '../db/client';
import { sql } from 'kysely';
import { publishEvent } from './bus';

export const executeRollback = async (runId: string, targetStepIndex: number) => {
    // 1. Revert transactions
    const logs = await db.selectFrom('audit_log')
        .selectAll()
        .where('event_type', '=', 'TRANSACTION_LOG')
        .where('actor', '=', runId)
        .orderBy('timestamp', 'desc')
        .execute();

    for (const log of logs) {
        try {
            const payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
            if (payload && payload.stepIndex >= targetStepIndex) {
                // Reverse the operation
                if (log.entity_id === 'INSERT') {
                    // The identity is the table, the inversePayload has the id to delete
                    await sql`DELETE FROM ${sql.raw(log.entity_type)} WHERE id = ${payload.inversePayload.id}`.execute(db);
                } else if (log.entity_id === 'SLACK_MESSAGE') {
                    // Send API call to Slack to delete message if we had real auth
                    console.log(`[Rollback] Deleted simulated Slack message in ${log.entity_type}`);
                }
                // Delete the audit log entry so we don't rollback twice
                await db.deleteFrom('audit_log').where('id', '=', log.id).execute();
            }
        } catch (e) {
            console.error('[Rollback] Error processing log', e);
        }
    }

    // 2. Delete healing events >= targetStepIndex
    // First find step ids
    const stepIds = await db.selectFrom('run_steps')
        .select('id')
        .where('run_id', '=', runId)
        .where('step_index', '>=', targetStepIndex)
        .execute();

    if (stepIds.length > 0) {
        await db.deleteFrom('healing_events')
            .where('step_id', 'in', stepIds.map(s => s.id))
            .execute();
    }

    // 3. Delete run_steps >= targetStepIndex
    await db.deleteFrom('run_steps')
        .where('run_id', '=', runId)
        .where('step_index', '>=', targetStepIndex)
        .execute();

    // 4. Delete snapshots >= targetStepIndex
    await db.deleteFrom('snapshots')
        .where('run_id', '=', runId)
        .where('step_index', '>=', targetStepIndex)
        .execute();

    // 5. Update workflow run status back to RUNNING
    await db.updateTable('workflow_runs')
        .set({ status: 'RUNNING' })
        .where('id', '=', runId)
        .execute();

    await publishEvent(runId, { type: 'ROLLED_BACK', stepIndex: targetStepIndex - 1, payload: { targetStepIndex } });
};
