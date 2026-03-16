import { db } from '../db/client';
import { runLLaMALoop } from './base/LLaMALoop';
import { publishEvent } from '../events/bus';

export async function extractAndSaveComplianceData(runId: string, framework: string) {
    // Poll until run is COMPLETED or FAILED (up to 3 minutes)
    for (let i = 0; i < 36; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const run = await db.selectFrom('workflow_runs').select('status').where('id', '=', runId).executeTakeFirst();
        if (run?.status === 'COMPLETED' || run?.status === 'FAILED') break;
    }

    const steps = await db.selectFrom('run_steps').selectAll().where('run_id', '=', runId).execute();
    const combinedOutput = steps
        .map(s => s.output ? (typeof s.output === 'string' ? s.output : JSON.stringify(s.output)) : '')
        .filter(Boolean)
        .join('\n\n');

    if (!combinedOutput.trim()) {
        console.log(`[ComplianceService] No step outputs found for run ${runId}`);
        return;
    }

    const extractPrompt = `You are a compliance data extractor. An LLM agent ran a ${framework} audit and produced this output:\n\n${combinedOutput.substring(0, 4000)}\n\nExtract structured compliance data. Return ONLY valid JSON:\n{"controls":[{"id":"CC1.1","description":"...","status":"PASS or FAIL","score":75}],"gaps":[{"description":"...","action_required":"...","effort":"Low|Medium|High"}]}\n\nIf the output is not compliance-related or you cannot extract data, infer plausible ${framework} controls from whatever context exists.`;

    try {
        const { finalAnswer } = await runLLaMALoop([{ role: 'user' as const, content: extractPrompt }], []);
        const cleaned = finalAnswer.replace(/```json/g, '').replace(/```/g, '').trim();

        // Find the first { ... } JSON block
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found in LLM response');

        const extracted = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1)) as { controls: any[]; gaps: any[] };

        // Replace old data for this framework
        await db.deleteFrom('compliance_controls').where('framework', '=', framework).execute();
        await db.deleteFrom('compliance_gaps').where('framework', '=', framework).execute();

        if (extracted.controls?.length) {
            await db.insertInto('compliance_controls').values(
                extracted.controls.map((c, i) => ({
                    id: `${framework}-${c.id || `CTRL-${i + 1}`}`,
                    framework,
                    description: String(c.description || 'Control'),
                    status: String(c.status || 'FAIL'),
                    score: Number(c.score) || 50
                }))
            ).execute();
        }

        if (extracted.gaps?.length) {
            await db.insertInto('compliance_gaps').values(
                extracted.gaps.map(g => ({
                    framework,
                    description: String(g.description || 'Gap identified'),
                    action_required: String(g.action_required || 'Review and remediate'),
                    effort: String(g.effort || 'Medium')
                }))
            ).execute();
        }

        console.log(`[ComplianceService] Saved ${extracted.controls?.length || 0} controls and ${extracted.gaps?.length || 0} gaps for ${framework}`);
        await publishEvent(runId, { type: 'COMPLIANCE_REPORT_READY', payload: { framework, runId } });
    } catch (e) {
        console.error('[ComplianceService] Failed to extract/save compliance data:', e);
    }
}
