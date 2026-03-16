import { db } from '../db/client';
import { runLLaMALoop } from './base/LLaMALoop';
import { publishEvent, redisSub } from '../events/bus';
import { getFullSnapshot } from '../events/snapshots';
import { executeTool } from './base/ToolRegistry';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface HealingStrategy {
    rootCause: string;
    strategy: string;
}

interface AutopsyContentJson {
    runId: string;
    strategies: HealingStrategy[];
    success: boolean;
    report: string;
    confidenceHistory: number[];
}

export class HealerAgent {
    private healingInProgress = new Set<string>();

    public listen(runId: string) {
        redisSub.subscribe(`run:events:${runId}`);
        redisSub.on('message', async (channel: string, message: string) => {
            if (channel !== `run:events:${runId}`) return;
            const event = JSON.parse(message) as { type: string; stepIndex?: number; payload?: any };
            if (event.type === 'HEAL_REQUIRED' && event.stepIndex !== undefined) {
                const key = `${runId}:${event.stepIndex}`;
                if (this.healingInProgress.has(key)) {
                    console.log(`[HealerAgent] Already healing ${key}, skipping duplicate HEAL_REQUIRED`);
                    return;
                }
                this.healingInProgress.add(key);
                this.heal(runId, event.stepIndex, event.payload)
                    .catch(console.error)
                    .finally(() => this.healingInProgress.delete(key));
            }
        });
    }

    public async heal(runId: string, stepIndex: number, errorPayload?: any) {
        await publishEvent(runId, { type: 'HEALER_ACTIVATED', stepIndex });

        const step = await db.selectFrom('run_steps')
            .selectAll()
            .where('run_id', '=', runId)
            .where('step_index', '=', stepIndex)
            .executeTakeFirst();
        const stepId = step?.id ?? 'unknown';

        let success = false;
        const maxRetries = 3;
        const strategies: HealingStrategy[] = [];

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            await publishEvent(runId, { type: 'HEAL_ATTEMPT', stepIndex, payload: { attempt } });

            const prior = strategies.length > 0
                ? ` NOTE: You have already attempted the following recovery strategies and they failed: ${strategies.map(s => `"${s.strategy}"`).join(', ')}. You MUST generate a completely new, alternative strategy.`
                : '';

            const diagnosisMessages = [
                { role: 'user' as const, content: `Agent '${step?.agent_type}' failed at step ${stepIndex}. Input: ${step?.input}. Error details: ${JSON.stringify(errorPayload)}.${prior} Generate root cause diagnosis and a NEW execution strategy. Return ONLY JSON { "rootCause": string, "strategy": string }` }
            ];
            const diagStr = await runLLaMALoop(diagnosisMessages, []);
            let diagnosis: HealingStrategy = { rootCause: 'Unknown', strategy: 'Retry' };
            try {
                const cleaned = diagStr.finalAnswer.replace(/```json/g, '').replace(/```/g, '');
                diagnosis = JSON.parse(cleaned) as HealingStrategy;
            } catch { }

            strategies.push(diagnosis);

            const workerMessages = [
                { role: 'system' as const, content: `Execute strategy: ${diagnosis.strategy}` }
            ];
            try {
                const { finalAnswer, conversationHistory } = await runLLaMALoop(workerMessages, ['call_api', 'write_db', 'query_db'], { runId, stepIndex });

                await db.updateTable('run_steps')
                    .set({
                        output: JSON.stringify(finalAnswer),
                        confidence_score: 100,
                        llm_conversation: JSON.stringify(conversationHistory),
                        status: 'COMPLETED'
                    })
                    .where('run_id', '=', runId)
                    .where('step_index', '=', stepIndex)
                    .execute();

                await publishEvent(runId, { type: 'STEP_OUTPUT', stepIndex, payload: { output: finalAnswer, score: 100 } });
                await publishEvent(runId, { type: 'HEAL_SUCCEEDED', stepIndex });
                success = true;
                break;
            } catch {
                await publishEvent(runId, { type: 'HEAL_FAILED', stepIndex, payload: { attempt } });
            }
        }

        if (!success) {
            await this.triggerRollback(runId, stepIndex);
            const tokenResult = await executeTool('generate_hitl_token', JSON.stringify({ hitlId: runId })) as { token: string; hitlUrl: string };

            await db.insertInto('hitl_requests').values({
                run_id: runId,
                step_id: stepId,
                llm_briefing: `Healer agent exhausted ${maxRetries} retries at step ${stepIndex}. Strategies attempted: ${strategies.map(s => s.strategy).join(', ')}. Manual intervention required.`,
                status: 'PENDING'
            }).execute();

            await db.updateTable('run_steps')
                .set({ status: 'REQUIRES_HITL' })
                .where('id', '=', stepId)
                .execute();

            await publishEvent(runId, { type: 'HITL_TRIGGERED', stepIndex, payload: { hitlUrl: tokenResult.hitlUrl } });

            await executeTool('post_slack', JSON.stringify({
                channel: 'ops-alerts',
                message: `🚨 HITL Required: Run ${runId} stalled at step ${stepIndex}. Healing exhausted after ${maxRetries} attempts. Approve: ${tokenResult.hitlUrl}`
            }));
        }

        await db.insertInto('healing_events').values({
            run_id: runId,
            step_id: stepId,
            event_type: 'HEAL_ATTEMPT',
            llm_diagnosis: JSON.stringify(strategies),
            strategies_tried: JSON.stringify(strategies),
            outcome: success ? 'RESOLVED' : 'ESCALATED_HITL'
        }).execute();

        // Only generate autopsy if actual healing attempts were made
        if (strategies.length > 0) {
            await this.generateAutopsy(runId, stepId, strategies, success, errorPayload);
        }
    }

    private async triggerRollback(runId: string, fromStepIndex: number) {
        await publishEvent(runId, { type: 'ROLLBACK_STARTED', stepIndex: fromStepIndex });
        await getFullSnapshot(runId, fromStepIndex - 1);
        await publishEvent(runId, { type: 'ROLLBACK_COMPLETED', stepIndex: fromStepIndex });
    }

    private async generateAutopsy(runId: string, stepId: string, strategies: HealingStrategy[], success: boolean, originalError?: any) {
        const run = await db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
        const steps = await db.selectFrom('run_steps')
            .selectAll()
            .where('run_id', '=', runId)
            .orderBy('step_index', 'asc')
            .execute();

        const failedStep = steps.find(s => s.id === stepId);

        const promptContext = `
You are the Lead Reliability Engineer. Write a concise, technical post-mortem (Autopsy) report for a workflow step failure. Use markdown.

Context:
- Workflow ID: ${run?.workflow_id || 'Unknown'}
- Failed Agent: ${failedStep?.agent_type || 'Unknown'}
- Original Input: ${failedStep?.input || 'Unknown'}
- Root Error Triggers: ${JSON.stringify(originalError)}
- Diagnosis & Strategies Attempted: ${JSON.stringify(strategies)}
- Final Outcome: ${success ? 'RESOLVED (Successfully Healed)' : 'ESCALATED TO HITL (Failed 3 Retries)'}

Format it strictly with these headings:
### Incident Summary
### Root Cause Analysis
### Recovery Actions Taken
### Final Outcome & Recommendations
`;

        const reportStr = await runLLaMALoop([
            { role: 'user' as const, content: promptContext }
        ], []);

        const confidenceHistory = steps
            .map(s => s.confidence_score)
            .filter((s): s is number => s !== null && s !== undefined);

        const contentJson: AutopsyContentJson = {
            runId,
            strategies,
            success,
            report: reportStr.finalAnswer,
            confidenceHistory
        };

        const autopsyRecord = await db.insertInto('autopsy_reports').values({
            run_id: runId,
            content_json: JSON.stringify(contentJson)
        }).returning('id').executeTakeFirstOrThrow();

        await publishEvent(runId, { type: 'AUTOPSY_GENERATED', payload: { reportText: reportStr.finalAnswer } });

        const pdfPath = await this.renderAutopsyPdf(runId, contentJson, run?.workflow_id ?? 'unknown');

        await db.updateTable('autopsy_reports')
            .set({ pdf_path: pdfPath })
            .where('id', '=', autopsyRecord.id)
            .execute();

        await publishEvent(runId, { type: 'AUTOPSY_PDF_READY', payload: { pdfPath } });
    }

    private buildSparklineSvg(scores: number[]): string {
        if (scores.length === 0) return '';
        const width = 200;
        const height = 60;
        const xStep = scores.length > 1 ? width / (scores.length - 1) : width;

        const points = scores
            .map((score, i) => {
                const x = i * xStep;
                const y = ((100 - score) / 100) * height;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');

        const dots = scores.map((score, i) => {
            const x = i * xStep;
            const y = ((100 - score) / 100) * height;
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#00D4FF"><title>${score}</title></circle>`;
        }).join('');

        return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <polyline points="${points}" fill="none" stroke="#00D4FF" stroke-width="2"/>
            ${dots}
        </svg>`;
    }

    private async renderAutopsyPdf(runId: string, content: AutopsyContentJson, workflowId: string): Promise<string> {
        const outDir = '/tmp/flowsentrix/docs';
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        const pdfPath = path.join(outDir, `autopsy_${runId}.pdf`);

        const sparklineSvg = this.buildSparklineSvg(content.confidenceHistory);
        const strategiesHtml = content.strategies
            .map((s, i) => `<tr><td>${i + 1}</td><td>${s.rootCause}</td><td>${s.strategy}</td></tr>`)
            .join('');

        const html = `<!DOCTYPE html><html>
        <head>
            <style>
                body { font-family: 'Courier New', monospace; background: #0A0A0B; color: #fff; padding: 40px; }
                h1 { color: #00D4FF; border-bottom: 2px solid #00D4FF; padding-bottom: 12px; }
                h2 { color: #00D4FF; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-top: 30px; }
                .meta { color: #888; font-size: 12px; margin-bottom: 30px; }
                .report { background: #111; border-left: 4px solid #00D4FF; padding: 20px; white-space: pre-wrap; font-size: 13px; line-height: 1.6; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { background: #1a1a1e; text-align: left; padding: 8px; color: #888; text-transform: uppercase; }
                td { padding: 8px; border-bottom: 1px solid #333; }
                .outcome { color: ${content.success ? '#22c55e' : '#ef4444'}; font-weight: bold; }
                .sparkline-container { background: #111; padding: 16px; border: 1px solid #333; }
                .footer { color: #555; font-size: 11px; margin-top: 40px; border-top: 1px solid #333; padding-top: 16px; }
            </style>
        </head>
        <body>
            <h1>FlowSentrix — Autopsy Report</h1>
            <div class="meta">
                Run ID: ${runId}<br>
                Workflow: ${workflowId}<br>
                Outcome: <span class="outcome">${content.success ? 'RESOLVED' : 'ESCALATED TO HITL'}</span>
            </div>

            <h2>Healing Summary</h2>
            <table>
                <thead><tr><th>#</th><th>Root Cause</th><th>Strategy Applied</th></tr></thead>
                <tbody>${strategiesHtml}</tbody>
            </table>

            <h2>Agent Report</h2>
            <div class="report">${content.report}</div>

            ${content.confidenceHistory.length > 0 ? `
            <h2>Confidence Score History</h2>
            <div class="sparkline-container">${sparklineSvg}</div>
            ` : ''}

            <div class="footer">
                Generated at: ${new Date().toISOString()} — FlowSentrix Self-Healing Pipeline
            </div>
        </body></html>`;

        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
        await browser.close();

        return pdfPath;
    }
}
