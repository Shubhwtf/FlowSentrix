import { db } from '../db/client';
import { runLLaMALoop } from './base/LLaMALoop';
import { publishEvent } from '../events/bus';
import { getFullSnapshot } from '../events/snapshots';
import { executeTool } from './base/ToolRegistry';

export class HealerAgent {
    public async heal(runId: string, stepIndex: number) {
        await publishEvent(runId, { type: 'HEALER_ACTIVATED', stepIndex });

        let success = false;
        const maxRetries = 3;
        const strategies = [];

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            await publishEvent(runId, { type: 'HEAL_ATTEMPT', stepIndex, payload: { attempt } });

            const diagnosisMessages = [{ role: 'user', content: 'Generate root cause diagnosis and new strategy. Return JSON { "rootCause": string, "strategy": string }' }];
            const diagStr = await runLLaMALoop(diagnosisMessages, []);
            let diagnosis = { rootCause: "Unknown", strategy: "Retry" };
            try {
                const cleaned = diagStr.finalAnswer.replace(/```json/g, '').replace(/```/g, '');
                diagnosis = JSON.parse(cleaned);
            } catch { }

            strategies.push(diagnosis);

            const workerMessages = [{ role: 'system', content: `Execute strategy: ${diagnosis.strategy}` }];
            try {
                await runLLaMALoop(workerMessages, ['call_api', 'write_db', 'query_db'], { runId, stepIndex });

                await publishEvent(runId, { type: 'HEAL_SUCCEEDED', stepIndex });
                success = true;
                break;
            } catch (e) {
                await publishEvent(runId, { type: 'HEAL_FAILED', stepIndex, payload: { attempt } });
            }
        }

        if (!success) {
            await this.triggerRollback(runId, stepIndex);
            const { hitlUrl } = await executeTool('generate_hitl_token', JSON.stringify({ hitlId: runId }));
            await publishEvent(runId, { type: 'HITL_TRIGGERED', stepIndex, payload: { hitlUrl } });
        }

        await this.generateAutopsy(runId, strategies, success);
    }

    private async triggerRollback(runId: string, fromStepIndex: number) {
        await publishEvent(runId, { type: 'ROLLBACK_STARTED', stepIndex: fromStepIndex });
        await getFullSnapshot(runId, fromStepIndex - 1);
        await publishEvent(runId, { type: 'ROLLBACK_COMPLETED', stepIndex: fromStepIndex });
    }

    private async generateAutopsy(runId: string, strategies: any[], success: boolean) {
        const reportStr = await runLLaMALoop([{ role: 'user', content: `Write autopsy report in plain English for: ${JSON.stringify(strategies)} | success: ${success}` }], []);
        await db.insertInto('autopsy_reports').values({
            run_id: runId,
            content_json: JSON.stringify({ strategies, success, report: reportStr.finalAnswer })
        }).execute();
        await publishEvent(runId, { type: 'AUTOPSY_GENERATED', payload: { reportText: reportStr.finalAnswer } });
    }
}
