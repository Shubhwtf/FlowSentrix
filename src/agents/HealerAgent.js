"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealerAgent = void 0;
const client_1 = require("../db/client");
const LLaMALoop_1 = require("./base/LLaMALoop");
const bus_1 = require("../events/bus");
const snapshots_1 = require("../events/snapshots");
const ToolRegistry_1 = require("./base/ToolRegistry");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const resend_1 = require("resend");
const templates_1 = require("../integrations/email/templates");
const safeJson = (value, fallback = 'null') => {
    try {
        return JSON.stringify(value, null, 2);
    }
    catch {
        return fallback;
    }
};
const escapeHtml = (s) => s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const markdownToHtmlLite = (md) => {
    const src = String(md || '').replace(/\r\n/g, '\n');
    const lines = src.split('\n');
    const out = [];
    let i = 0;
    const isTableSep = (line) => /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);
    const splitRow = (line) => {
        const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
        return trimmed.split('|').map(c => c.trim());
    };
    while (i < lines.length) {
        const line = lines[i];
        const h3 = line.match(/^###\s+(.*)$/);
        if (h3) {
            out.push(`<h3>${escapeHtml(h3[1])}</h3>`);
            i++;
            continue;
        }
        const h4 = line.match(/^####\s+(.*)$/);
        if (h4) {
            out.push(`<h4>${escapeHtml(h4[1])}</h4>`);
            i++;
            continue;
        }
        // Markdown pipe tables: header row, separator row, body rows
        if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
            const header = splitRow(line);
            i += 2;
            const body = [];
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
                body.push(splitRow(lines[i]));
                i++;
            }
            const thead = `<thead><tr>${header.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
            const tbody = `<tbody>${body.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
            out.push(`<table class="md-table">${thead}${tbody}</table>`);
            continue;
        }
        if (line.trim() === '') {
            i++;
            continue;
        }
        // Simple paragraph (collapse consecutive non-empty lines)
        const para = [];
        while (i < lines.length && lines[i].trim() !== '') {
            para.push(lines[i]);
            i++;
        }
        out.push(`<p>${escapeHtml(para.join(' '))}</p>`);
    }
    return out.join('\n');
};
class HealerAgent {
    healingInProgress = new Set();
    static activeHealerRuns = new Set();
    listen(runId) {
        if (HealerAgent.activeHealerRuns.has(runId))
            return;
        HealerAgent.activeHealerRuns.add(runId);
        const sub = bus_1.redisSub.duplicate();
        sub.subscribe(`run:events:${runId}`);
        sub.on('message', async (channel, message) => {
            if (channel !== `run:events:${runId}`)
                return;
            const event = JSON.parse(message);
            console.log(`[HealerAgent] [${runId}] Received event: ${event.type}`);
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
    async heal(runId, stepIndex, errorPayload) {
        await (0, bus_1.publishEvent)(runId, { type: 'HEALER_ACTIVATED', stepIndex });
        const step = await client_1.db.selectFrom('run_steps')
            .selectAll()
            .where('run_id', '=', runId)
            .where('step_index', '=', stepIndex)
            .executeTakeFirst();
        const stepId = step?.id ?? 'unknown';
        if (!step)
            return;
        if (step.status !== 'FAILED' && step.status !== 'REQUIRES_HITL') {
            console.log(`[HealerAgent] [${runId}] Step ${stepIndex} is ${step.status}; skipping heal.`);
            return;
        }
        const errorStr = (() => {
            if (typeof errorPayload === 'string')
                return errorPayload;
            if (errorPayload && typeof errorPayload.error === 'string')
                return errorPayload.error;
            try {
                return JSON.stringify(errorPayload);
            }
            catch {
                return String(errorPayload);
            }
        })();
        const run = await client_1.db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
        const workflow = run
            ? await client_1.db.selectFrom('workflow_definitions').selectAll().where('id', '=', run.workflow_id).executeTakeFirst()
            : undefined;
        const disabled = (process.env.DISABLE_HEALING_WORKFLOWS || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        if (run?.workflow_id && disabled.includes(run.workflow_id)) {
            await (0, bus_1.publishEvent)(runId, { type: 'HEAL_SKIPPED', stepIndex, payload: { reason: 'HealingDisabledForWorkflow', workflowId: run.workflow_id } });
            await client_1.db.insertInto('healing_events').values({
                run_id: runId,
                step_id: stepId,
                event_type: 'HEAL_ATTEMPT',
                llm_diagnosis: JSON.stringify([{ rootCause: 'Healing disabled for workflow', strategy: 'Skip healing.' }]),
                strategies_tried: JSON.stringify([{ rootCause: 'Healing disabled for workflow', strategy: 'Skip healing.' }]),
                outcome: 'ESCALATED_HITL'
            }).execute();
            return;
        }
        const stepsConf = workflow
            ? (typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps)
            : [];
        const stepDef = Array.isArray(stepsConf) ? stepsConf.find(s => s.index === stepIndex) : undefined;
        let success = false;
        const maxRetries = 3;
        const strategies = [];
        const triggerHitl = async () => {
            await this.triggerRollback(runId, stepIndex);
            const tokenResult = await (0, ToolRegistry_1.executeTool)('generate_hitl_token', JSON.stringify({ hitlId: runId }));
            await client_1.db.insertInto('hitl_requests').values({
                id: tokenResult.token,
                run_id: runId,
                step_id: stepId,
                llm_briefing: `Healer agent exhausted ${maxRetries} retries at step ${stepIndex}. Strategies attempted: ${strategies.map(s => s.strategy).join(', ')}. Manual intervention required.`,
                status: 'PENDING'
            }).execute();
            await client_1.db.updateTable('run_steps')
                .set({ status: 'REQUIRES_HITL' })
                .where('id', '=', stepId)
                .execute();
            await (0, bus_1.publishEvent)(runId, { type: 'HITL_TRIGGERED', stepIndex, payload: { hitlUrl: tokenResult.hitlUrl } });
            await (0, ToolRegistry_1.executeTool)('post_slack', JSON.stringify({
                channel: 'ops',
                message: `🚨 HITL Required: Run ${runId} stalled at step ${stepIndex}. Healing exhausted after ${maxRetries} attempts. Approve: ${tokenResult.hitlUrl}`
            }));
            if (run?.workflow_id === 'employee_onboarding' || run?.workflow_id === 'onboarding_pipeline') {
                await (0, ToolRegistry_1.executeTool)('post_slack', JSON.stringify({
                    channel: 'onboarding',
                    message: `⚠️ HITL Required during onboarding: Run \`${runId}\` stalled at step ${stepIndex}. Review: ${tokenResult.hitlUrl}`
                }));
            }
            if (process.env.MOCK_SMTP !== 'true' && process.env.RESEND_API_KEY) {
                try {
                    const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
                    const email = process.env.EMAIL_DEMO_RECIPIENT || 'team@example.com';
                    const briefing = `Healer agent exhausted ${maxRetries} retries. Strategies attempted: ${strategies.map((s) => s.strategy).join(', ')}`;
                    const html = (0, templates_1.buildHitlEmailHtml)(runId, stepIndex, tokenResult.hitlUrl, briefing);
                    await resend.emails.send({
                        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
                        to: email,
                        subject: `[FlowSentrix] ACTION REQUIRED: HITL Intervention (${runId})`,
                        html
                    });
                }
                catch (e) {
                    console.error("Failed to send HITL email:", e);
                }
            }
        };
        const existingHeals = await client_1.db.selectFrom('healing_events')
            .select('id')
            .where('run_id', '=', runId)
            .where('step_id', '=', stepId)
            .execute();
        const currentAttempts = existingHeals.length;
        if (errorStr.includes('GroqRateLimitExceeded')) {
            await triggerHitl();
            await client_1.db.insertInto('healing_events').values({
                run_id: runId,
                step_id: stepId,
                event_type: 'HEAL_ATTEMPT',
                llm_diagnosis: JSON.stringify([{ rootCause: 'GroqRateLimitExceeded', strategy: 'Escalate to HITL (no further LLM calls).' }]),
                strategies_tried: JSON.stringify([{ rootCause: 'GroqRateLimitExceeded', strategy: 'Escalate to HITL (no further LLM calls).' }]),
                outcome: 'ESCALATED_HITL'
            }).execute();
            return;
        }
        if (currentAttempts >= 3) {
            await triggerHitl();
            await client_1.db.insertInto('healing_events').values({
                run_id: runId,
                step_id: stepId,
                event_type: 'HEAL_ATTEMPT',
                llm_diagnosis: JSON.stringify(strategies),
                strategies_tried: JSON.stringify(strategies),
                outcome: 'ESCALATED_HITL'
            }).execute();
            return;
        }
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            await (0, bus_1.publishEvent)(runId, { type: 'HEAL_ATTEMPT', stepIndex, payload: { attempt } });
            if (attempt > 3) {
                await triggerHitl();
                break;
            }
            const prior = strategies.length > 0
                ? ` NOTE: You have already attempted the following recovery strategies and they failed: ${strategies.map(s => `"${s.strategy}"`).join(', ')}. You MUST generate a completely new, alternative strategy.`
                : '';
            const diagnosisMessages = [
                { role: 'user', content: `Agent '${step?.agent_type}' failed at step ${stepIndex}. Input: ${step?.input}. Error details: ${JSON.stringify(errorPayload)}.${prior} Generate root cause diagnosis and a NEW execution strategy. Return ONLY JSON { "rootCause": string, "strategy": string }` }
            ];
            const diagStr = await (0, LLaMALoop_1.runLLaMALoop)(diagnosisMessages, []);
            let diagnosis = { rootCause: 'Unknown', strategy: 'Retry' };
            try {
                const cleaned = diagStr.finalAnswer.replace(/```json/g, '').replace(/```/g, '');
                diagnosis = JSON.parse(cleaned);
            }
            catch { }
            strategies.push(diagnosis);
            const triggerPayload = run?.trigger_payload
                ? (typeof run.trigger_payload === 'string' ? JSON.parse(run.trigger_payload) : run.trigger_payload)
                : {};
            const allowedTools = Array.isArray(stepDef?.allowedTools) && stepDef.allowedTools.length > 0
                ? stepDef.allowedTools
                : [];
            const systemPrompt = `${stepDef?.systemPrompt || `You are an autonomous agent.`}\n\nHEALING STRATEGY: ${diagnosis.strategy}\n\nCRITICAL DIRECTIVE: You MUST complete this task using ONLY the provided tools and context.`;
            const workerMessages = [
                { role: 'system', content: systemPrompt },
                { role: 'system', content: `Context: ${JSON.stringify({ runId, stepIndex }).substring(0, 1600)}` },
                { role: 'user', content: `Task Input: ${JSON.stringify(triggerPayload).substring(0, 800)}` }
            ];
            try {
                const { finalAnswer, conversationHistory } = await (0, LLaMALoop_1.runLLaMALoop)(workerMessages, allowedTools, { runId, stepIndex });
                if (typeof finalAnswer !== 'string' || finalAnswer.trim().length === 0) {
                    throw new Error('EmptyHealingResult');
                }
                await client_1.db.updateTable('run_steps')
                    .set({
                    output: JSON.stringify(finalAnswer),
                    confidence_score: 100,
                    llm_conversation: JSON.stringify(conversationHistory),
                    status: 'COMPLETED'
                })
                    .where('run_id', '=', runId)
                    .where('step_index', '=', stepIndex)
                    .execute();
                await (0, bus_1.publishEvent)(runId, { type: 'STEP_OUTPUT', stepIndex, payload: { output: finalAnswer, score: 100 } });
                await (0, bus_1.publishEvent)(runId, { type: 'HEAL_SUCCEEDED', stepIndex });
                success = true;
                break;
            }
            catch {
                await (0, bus_1.publishEvent)(runId, { type: 'HEAL_FAILED', stepIndex, payload: { attempt } });
            }
        }
        if (!success) {
            await triggerHitl();
        }
        await client_1.db.insertInto('healing_events').values({
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
    async triggerRollback(runId, fromStepIndex) {
        await (0, bus_1.publishEvent)(runId, { type: 'ROLLBACK_STARTED', stepIndex: fromStepIndex });
        await (0, snapshots_1.getFullSnapshot)(runId, fromStepIndex - 1);
        await (0, bus_1.publishEvent)(runId, { type: 'ROLLBACK_COMPLETED', stepIndex: fromStepIndex });
    }
    async generateAutopsy(runId, stepId, strategies, success, originalError) {
        // Prevent redundant autopsies for the same run
        const existingReport = await client_1.db.selectFrom('autopsy_reports')
            .selectAll()
            .where('run_id', '=', runId)
            .executeTakeFirst();
        if (existingReport && existingReport.pdf_path) {
            console.log(`[HealerAgent] Autopsy for run ${runId} already exists. Skipping.`);
            return;
        }
        const run = await client_1.db.selectFrom('workflow_runs').selectAll().where('id', '=', runId).executeTakeFirst();
        const steps = await client_1.db.selectFrom('run_steps')
            .selectAll()
            .where('run_id', '=', runId)
            .orderBy('step_index', 'asc')
            .execute();
        const failedStep = steps.find(s => s.id === stepId);
        const workflowId = run?.workflow_id ?? 'Unknown';
        const failedAgentType = failedStep?.agent_type ?? 'Unknown';
        const failedStepIndex = failedStep?.step_index ?? -1;
        const finalStepStatus = failedStep?.status ?? null;
        const finalConfidenceScore = typeof failedStep?.confidence_score === 'number' ? failedStep.confidence_score : null;
        const runStartedAt = run?.started_at ? new Date(run.started_at).toISOString() : null;
        const runCompletedAt = run?.completed_at ? new Date(run.completed_at).toISOString() : null;
        const durationMs = run?.started_at
            ? (new Date(run.completed_at ?? Date.now()).getTime() - new Date(run.started_at).getTime())
            : null;
        const triggerPayload = run?.trigger_payload
            ? (typeof run.trigger_payload === 'string' ? JSON.parse(run.trigger_payload) : run.trigger_payload)
            : null;
        const originalStepInput = failedStep?.input
            ? (typeof failedStep.input === 'string' ? (() => { try {
                return JSON.parse(failedStep.input);
            }
            catch {
                return failedStep.input;
            } })() : failedStep.input)
            : null;
        const originalStepOutput = failedStep?.output
            ? (typeof failedStep.output === 'string' ? (() => { try {
                return JSON.parse(failedStep.output);
            }
            catch {
                return failedStep.output;
            } })() : failedStep.output)
            : null;
        const promptContext = `
You are the Lead Reliability Engineer. Write a concise, technical post-mortem (Autopsy) report for a workflow step failure. Use markdown.

Context:
- Workflow ID: ${workflowId}
- Run ID: ${runId}
- Failed Agent: ${failedAgentType}
- Failed Step Index: ${failedStepIndex}
- Run Started At: ${runStartedAt || 'Unknown'}
- Run Completed At: ${runCompletedAt || 'Unknown'}
- Duration (ms): ${durationMs === null ? 'Unknown' : durationMs}
- Trigger Payload (JSON): ${safeJson(triggerPayload, '"Unserializable"')}
- Step Input (JSON): ${safeJson(originalStepInput, '"Unserializable"')}
- Step Output (JSON): ${safeJson(originalStepOutput, '"Unserializable"')}
- Root Error Triggers: ${safeJson(originalError, '"Unserializable"')}
- Diagnosis & Strategies Attempted: ${safeJson(strategies, '"Unserializable"')}
- Final Outcome: ${success ? 'RESOLVED (Successfully Healed)' : 'ESCALATED TO HITL (Failed 3 Retries)'}

Format it strictly with these headings:
### Incident Summary
### Root Cause Analysis
### Recovery Actions Taken
### Final Outcome & Recommendations
`;
        const reportStr = await (0, LLaMALoop_1.runLLaMALoop)([
            { role: 'user', content: promptContext }
        ], []);
        const confidenceHistory = steps
            .map(s => s.confidence_score)
            .filter((s) => s !== null && s !== undefined);
        const originalScore = (() => {
            const v = originalError?.score;
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100)
                return v;
            return null;
        })();
        const mergedConfidenceHistory = (() => {
            const list = [...confidenceHistory];
            if (originalScore !== null) {
                if (list.length === 0 || list[0] !== originalScore) {
                    list.unshift(originalScore);
                }
            }
            return list;
        })();
        const contentJson = {
            runId,
            workflowId,
            failedAgentType,
            failedStepIndex,
            finalStepStatus,
            finalConfidenceScore,
            runStartedAt,
            runCompletedAt,
            durationMs,
            triggerPayload,
            originalStepInput,
            originalStepOutput,
            originalError,
            strategies,
            success,
            report: reportStr.finalAnswer,
            confidenceHistory: mergedConfidenceHistory
        };
        const autopsyRecord = await client_1.db.insertInto('autopsy_reports').values({
            run_id: runId,
            content_json: JSON.stringify(contentJson)
        }).returning('id').executeTakeFirstOrThrow();
        await (0, bus_1.publishEvent)(runId, { type: 'AUTOPSY_GENERATED', payload: { reportText: reportStr.finalAnswer } });
        const pdfPath = await this.renderAutopsyPdf(runId, contentJson);
        await client_1.db.updateTable('autopsy_reports')
            .set({ pdf_path: pdfPath })
            .where('id', '=', autopsyRecord.id)
            .execute();
        await (0, bus_1.publishEvent)(runId, { type: 'AUTOPSY_PDF_READY', payload: { pdfPath } });
        // Post minimal summary + PDF to Slack
        const wfName = run?.workflow_id ?? 'unknown';
        const summary = success
            ? `✅ *Heal Successful*: Step failure in \`${wfName}\` was automatically resolved.`
            : `❌ *Heal Failed*: Step in \`${wfName}\` could not be automatically recovered and requires manual triage.`;
        await (0, ToolRegistry_1.executeTool)('post_slack', JSON.stringify({
            channel: 'ops',
            message: summary
        }));
        await (0, ToolRegistry_1.executeTool)('post_slack_file', JSON.stringify({
            channel: 'ops',
            filePath: pdfPath,
            initialComment: `📄 *Autopsy Report* for Run \`${runId}\``
        }));
    }
    buildSparklineSvg(scores) {
        if (scores.length === 0)
            return '';
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
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#111111"><title>${score}</title></circle>`;
        }).join('');
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="${points}" fill="none" stroke="#111111" stroke-width="2"/>
            ${dots}
        </svg>`;
    }
    async renderAutopsyPdf(runId, content) {
        const outDir = '/tmp/flowsentrix/docs';
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        const pdfPath = path.join(outDir, `autopsy_${runId}.pdf`);
        const sparklineSvg = this.buildSparklineSvg(content.confidenceHistory);
        const confidenceRows = (content.confidenceHistory || [])
            .map((s, idx) => `<tr><td>${idx + 1}</td><td>${s}</td></tr>`)
            .join('');
        const strategiesHtml = content.strategies
            .map((s, i) => `<tr><td>${i + 1}</td><td>${s.rootCause}</td><td>${s.strategy}</td></tr>`)
            .join('');
        const metaRows = [
            ['Run ID', content.runId],
            ['Workflow', content.workflowId],
            ['Failed Agent', content.failedAgentType],
            ['Failed Step Index', String(content.failedStepIndex)],
            ['Final Step Status', content.finalStepStatus ?? 'Unknown'],
            ['Final Confidence Score', content.finalConfidenceScore === null ? 'Unknown' : String(content.finalConfidenceScore)],
            ['Run Started', content.runStartedAt ?? 'Unknown'],
            ['Run Completed', content.runCompletedAt ?? 'Unknown'],
            ['Duration (ms)', content.durationMs === null ? 'Unknown' : String(content.durationMs)],
            ['Outcome', content.success ? 'RESOLVED' : 'ESCALATED TO HITL']
        ].map(([k, v]) => `<tr><td style="color:#52525b;text-transform:uppercase;letter-spacing:1px;width:180px;">${k}</td><td>${v}</td></tr>`).join('');
        const html = `<!DOCTYPE html><html>
        <head>
            <style>
                body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: #ffffff; color: #000; padding: 40px; }
                h1 { color: #000; border-bottom: 2px solid #000; padding-bottom: 12px; }
                h2 { color: #000; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-top: 28px; }
                h3 { color: #000; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; margin: 18px 0 8px; }
                h4 { color: #111; font-size: 12px; margin: 12px 0 6px; }
                .meta { color: #52525b; font-size: 12px; margin-bottom: 30px; }
                .kv { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                .kv td { padding: 6px 8px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
                .report { background: #fafafa; border-left: 4px solid #000; padding: 18px; font-size: 12px; line-height: 1.65; }
                .report p { margin: 8px 0; }
                .blob { background: #fafafa; border: 1px solid #e4e4e7; padding: 14px; white-space: pre-wrap; font-size: 12px; line-height: 1.55; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { background: #f4f4f5; text-align: left; padding: 8px; color: #52525b; text-transform: uppercase; }
                td { padding: 8px; border-bottom: 1px solid #e4e4e7; }
                .outcome { color: ${content.success ? '#16a34a' : '#dc2626'}; font-weight: bold; }
                .sparkline-container { background: #fafafa; padding: 16px; border: 1px solid #e4e4e7; }
                .footer { color: #71717a; font-size: 11px; margin-top: 40px; border-top: 1px solid #e4e4e7; padding-top: 16px; }
                .md-table { margin-top: 10px; }
                .md-table th { background: #f4f4f5; }
                .md-table td, .md-table th { border-bottom: 1px solid #e4e4e7; padding: 8px; vertical-align: top; }
                .mini th { font-size: 11px; }
                .mini td { font-size: 11px; }
            </style>
        </head>
        <body>
            <h1>FlowSentrix — Autopsy Report</h1>
            <div class="meta">
                <table class="kv">${metaRows}</table>
            </div>

            <h2>Original Trigger Payload</h2>
            <div class="blob">${safeJson(content.triggerPayload, '"Unserializable"')}</div>

            <h2>Original Step Input</h2>
            <div class="blob">${safeJson(content.originalStepInput, '"Unserializable"')}</div>

            <h2>Original Step Output</h2>
            <div class="blob">${safeJson(content.originalStepOutput, '"Unserializable"')}</div>

            <h2>Original Error</h2>
            <div class="blob">${safeJson(content.originalError, '"Unserializable"')}</div>

            <h2>Healing Summary</h2>
            <table>
                <thead><tr><th>#</th><th>Root Cause</th><th>Strategy Applied</th></tr></thead>
                <tbody>${strategiesHtml}</tbody>
            </table>

            <h2>Agent Report</h2>
            <div class="report">${markdownToHtmlLite(content.report)}</div>

            <h2>Confidence Score History</h2>
            ${content.confidenceHistory.length > 0 ? `
              <div class="sparkline-container">${sparklineSvg}</div>
              <table class="mini" style="margin-top:12px;">
                <thead><tr><th>#</th><th>Score</th></tr></thead>
                <tbody>${confidenceRows}</tbody>
              </table>
            ` : `<div class="blob">No confidence scores were recorded for this run.</div>`}

            <div class="footer">
                Generated at: ${new Date().toISOString()} — FlowSentrix Self-Healing Pipeline
            </div>
        </body></html>`;
        const browser = await puppeteer_1.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
        await browser.close();
        return pdfPath;
    }
}
exports.HealerAgent = HealerAgent;
