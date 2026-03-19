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
exports.registerAllTools = void 0;
const zod_1 = require("zod");
const ToolRegistry_1 = require("../base/ToolRegistry");
const ToolRegistry_2 = require("../base/ToolRegistry");
const client_1 = require("../../db/client");
const transactions_1 = require("../../events/transactions");
const resend_1 = require("resend");
const templates_1 = require("../../integrations/email/templates");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const docx_1 = require("docx");
const registerAllTools = () => {
    (0, ToolRegistry_1.registerTool)({
        name: 'query_db',
        description: 'Execute read-only SQL query against the database',
        schema: zod_1.z.object({ sql: zod_1.z.string(), params: zod_1.z.array(zod_1.z.any()).optional() }),
        execute: async ({ sql: queryStr, params }) => {
            const { sql } = await Promise.resolve().then(() => __importStar(require('kysely')));
            const result = await sql `${sql.raw(queryStr)}`.execute(client_1.db);
            return result.rows;
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'write_db',
        description: 'Write data to PostgreSQL. Operation: INSERT, UPDATE, DELETE.',
        schema: zod_1.z.object({
            sql: zod_1.z.string(),
            params: zod_1.z.array(zod_1.z.any()).optional(),
            agentConfidenceScore: zod_1.z.number().optional()
        }),
        execute: async ({ sql: writeSql }, context) => {
            const { sql } = await Promise.resolve().then(() => __importStar(require('kysely')));
            const rows = await sql `${sql.raw(writeSql)}`.execute(client_1.db);
            const result = rows.rows;
            if (context) {
                await (0, transactions_1.logTransaction)({
                    runId: context.runId,
                    stepIndex: context.stepIndex,
                    operationType: 'SQL',
                    target: 'raw_sql',
                    inversePayload: { result }
                });
            }
            return { success: true, result };
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'call_api',
        description: 'Call external REST API',
        schema: zod_1.z.object({ url: zod_1.z.string(), method: zod_1.z.string(), body: zod_1.z.any().optional(), headers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional() }),
        execute: async ({ url, method, body, headers }, context) => {
            try {
                const res = await fetch(url, {
                    method,
                    headers: headers || { 'Content-Type': 'application/json' },
                    body: body ? JSON.stringify(body) : undefined,
                    signal: AbortSignal.timeout(10000) // 10s timeout
                });
                const responseText = await res.text();
                try {
                    return { status: res.status, data: JSON.parse(responseText) };
                }
                catch {
                    return { status: res.status, data: responseText };
                }
            }
            catch (e) {
                return { error: e.message };
            }
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'read_email',
        description: 'Read emails from Microsoft Graph API',
        schema: zod_1.z.object({ mailboxId: zod_1.z.string().default('demo'), filters: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional() }),
        execute: async ({ mailboxId }, context) => {
            if (!context)
                return [];
            const run = await client_1.db.selectFrom('workflow_runs').selectAll().where('id', '=', context.runId).executeTakeFirst();
            if (run && run.trigger_payload) {
                const payload = typeof run.trigger_payload === 'string' ? JSON.parse(run.trigger_payload) : run.trigger_payload;
                if (payload.emailData)
                    return payload.emailData;
            }
            return [{ subject: 'New Hire: John Doe', body: 'Please onboard John Doe (jdoe@example.com) starting next Monday. Department: Engineering. Role: Senior Developer.' }];
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'generate_document',
        description: 'Generate PDF or DOCX from template and data',
        schema: zod_1.z.object({ template: zod_1.z.string(), format: zod_1.z.enum(['pdf', 'docx']).default('pdf'), data: zod_1.z.record(zod_1.z.string(), zod_1.z.any()) }),
        execute: async ({ template, format, data }, context) => {
            const outDir = path.join(process.cwd(), 'artifacts', 'docs');
            if (!fs.existsSync(outDir))
                fs.mkdirSync(outDir, { recursive: true });
            const filename = `${template}_${Date.now()}.${format}`;
            const outPath = path.join(outDir, filename);
            if (format === 'pdf') {
                const browser = await puppeteer_1.default.launch({ headless: true, args: ['--no-sandbox'] });
                const page = await browser.newPage();
                const html = `<html><body style="font-family:sans-serif;padding:40px;"><h1>${template}</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
                await page.setContent(html);
                await page.pdf({ path: outPath, format: 'A4' });
                await browser.close();
            }
            else {
                const doc = new docx_1.Document({
                    sections: [{
                            properties: {},
                            children: [
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: template, bold: true, size: 32 })] }),
                                new docx_1.Paragraph({ text: JSON.stringify(data, null, 2) })
                            ]
                        }]
                });
                const buffer = await docx_1.Packer.toBuffer(doc);
                fs.writeFileSync(outPath, buffer);
            }
            if (context) {
                await client_1.db.insertInto('audit_log').values({
                    entity_type: 'document',
                    entity_id: filename,
                    event_type: 'DOCUMENT_GENERATED',
                    actor: context.runId,
                    payload: JSON.stringify({ path: outPath, ...data })
                }).execute();
            }
            return { fileUrl: `file://${outPath}`, filename, bytes: fs.statSync(outPath).size };
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'read_file',
        description: 'Read file from GitHub repository',
        schema: zod_1.z.object({ repoPath: zod_1.z.string(), filePath: zod_1.z.string() }),
        execute: async ({ repoPath, filePath }) => {
            const isMock = process.env.MOCK_GITHUB === 'true';
            if (isMock)
                return { content: `function mock() { return "vulnerable"; }`, sha: 'mock-sha', path: filePath };
            const { Octokit } = await Promise.resolve().then(() => __importStar(require('@octokit/rest')));
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
            const owner = process.env.GITHUB_DEMO_REPO_OWNER || repoPath.split('/')[0];
            const repo = process.env.GITHUB_DEMO_REPO_NAME || repoPath.split('/')[1] || repoPath;
            try {
                const response = await octokit.repos.getContent({ owner, repo, path: filePath });
                const data = response.data;
                if (data.type === 'file' && data.content) {
                    const content = Buffer.from(data.content, 'base64').toString('utf-8');
                    return { content, sha: data.sha, path: data.path };
                }
                return { error: 'Not a file' };
            }
            catch (error) {
                return { error: error.message };
            }
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'open_pr',
        description: 'Open GitHub Pull Request',
        schema: zod_1.z.object({
            repo: zod_1.z.string(),
            filePath: zod_1.z.string(),
            fileContent: zod_1.z.string(),
            fileSha: zod_1.z.string(),
            title: zod_1.z.string(),
            body: zod_1.z.string(),
            commitMessage: zod_1.z.string()
        }),
        execute: async ({ repo, filePath, fileContent, fileSha, title, body, commitMessage }, context) => {
            const isMock = process.env.MOCK_GITHUB === 'true';
            if (isMock)
                return { prUrl: `https://github.com/${repo}/pull/101`, prNumber: 101, branchName: 'mock-branch', title };
            const { Octokit } = await Promise.resolve().then(() => __importStar(require('@octokit/rest')));
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
            const owner = process.env.GITHUB_DEMO_REPO_OWNER || 'unknown';
            const realRepo = process.env.GITHUB_DEMO_REPO_NAME || repo;
            const branchName = `flowsentrix/fix-${Date.now()}`;
            try {
                const { data: mainRef } = await octokit.git.getRef({ owner, repo: realRepo, ref: 'heads/main' });
                await octokit.git.createRef({ owner, repo: realRepo, ref: `refs/heads/${branchName}`, sha: mainRef.object.sha });
                await octokit.repos.createOrUpdateFileContents({
                    owner, repo: realRepo, path: filePath, message: commitMessage,
                    content: Buffer.from(fileContent).toString('base64'),
                    sha: fileSha, branch: branchName
                });
                const { data: pr } = await octokit.pulls.create({
                    owner, repo: realRepo, title, body, head: branchName, base: 'main'
                });
                if (context?.runId) {
                    try {
                        const run = await client_1.db.selectFrom('workflow_runs').selectAll().where('id', '=', context.runId).executeTakeFirst();
                        const payload = run?.trigger_payload
                            ? (typeof run.trigger_payload === 'string' ? JSON.parse(run.trigger_payload) : run.trigger_payload)
                            : {};
                        const vulnId = typeof payload.vulnerability_id === 'string'
                            ? payload.vulnerability_id
                            : typeof payload.id === 'string'
                                ? payload.id
                                : null;
                        if (vulnId) {
                            await client_1.db.updateTable('vulnerabilities')
                                .set({ pr_url: pr.html_url, status: 'pr_open' })
                                .where('id', '=', vulnId)
                                .execute();
                        }
                    }
                    catch { }
                }
                return { prNumber: pr.number, prUrl: pr.html_url, branchName, title };
            }
            catch (error) {
                return { error: error.message };
            }
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'read_pr_diff',
        description: 'Read the pull request diff and file contents from GitHub.',
        schema: zod_1.z.object({ prUrl: zod_1.z.string() }),
        execute: async ({ prUrl }) => {
            const isMock = process.env.MOCK_GITHUB === 'true';
            if (isMock)
                return { files: [{ filename: 'src/api/userController.ts', patch: '@@ -1,5 +1,5 @@\n- const a = 1;\n+ const a = 2;', fullContent: '...', additions: 1, deletions: 1 }] };
            const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
            if (!match)
                return { error: 'Invalid PR URL' };
            const [_, owner, repo, prNumberStr] = match;
            const prNumber = parseInt(prNumberStr, 10);
            const { Octokit } = await Promise.resolve().then(() => __importStar(require('@octokit/rest')));
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
            try {
                const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number: prNumber });
                const enrichedFiles = await Promise.all(files.map(async (f) => {
                    let fullContent = '';
                    try {
                        const { data: fileData } = await octokit.repos.getContent({ owner, repo, path: f.filename, ref: match ? undefined : 'main' });
                        if (fileData && fileData.content) {
                            fullContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
                        }
                    }
                    catch (e) { }
                    return {
                        filename: f.filename,
                        patch: f.patch,
                        fullContent,
                        additions: f.additions,
                        deletions: f.deletions
                    };
                }));
                return { files: enrichedFiles };
            }
            catch (error) {
                return { error: error.message };
            }
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'post_review_comment',
        description: 'Post inline comments to a GitHub Pull Request.',
        schema: zod_1.z.object({
            prUrl: zod_1.z.string(),
            verdict: zod_1.z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']),
            comments: zod_1.z.array(zod_1.z.object({ path: zod_1.z.string(), line: zod_1.z.number(), body: zod_1.z.string() }))
        }),
        execute: async ({ prUrl, verdict, comments }) => {
            const isMock = process.env.MOCK_GITHUB === 'true';
            if (isMock)
                return { success: true, verdict, posted: comments.length };
            const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
            if (!match)
                return { error: 'Invalid PR URL' };
            const [_, owner, repo, prNumberStr] = match;
            const prNumber = parseInt(prNumberStr, 10);
            const { Octokit } = await Promise.resolve().then(() => __importStar(require('@octokit/rest')));
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
            try {
                await octokit.pulls.createReview({
                    owner, repo, pull_number: prNumber,
                    event: verdict,
                    comments
                });
                return { success: true, verdict, posted: comments.length };
            }
            catch (error) {
                return { error: error.message };
            }
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'post_slack',
        description: 'Post message to Slack channel. Use types: security, risk, onboarding, ops.',
        schema: zod_1.z.object({ channel: zod_1.z.string(), message: zod_1.z.string() }),
        execute: async ({ channel, message }, context) => {
            const isMock = process.env.MOCK_SLACK === 'true';
            if (context) {
                await (0, transactions_1.logTransaction)({
                    runId: context.runId,
                    stepIndex: context.stepIndex,
                    operationType: 'SLACK_MESSAGE',
                    target: channel,
                    inversePayload: { message_deleted: true }
                });
            }
            if (isMock) {
                console.log(`[MOCK SLACK] #${channel}: ${message}`);
                return { success: true, channel, delivered: true, timestamp: new Date().toISOString() };
            }
            const { WebClient } = await Promise.resolve().then(() => __importStar(require('@slack/web-api')));
            const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
            // Map logical channel types to env vars
            let targetChannel = channel;
            if (channel === 'security')
                targetChannel = process.env.SLACK_CHANNEL_SECURITY || '#security-alerts';
            else if (channel === 'risk')
                targetChannel = process.env.SLACK_CHANNEL_RISK || '#risk-alerts';
            else if (channel === 'onboarding')
                targetChannel = process.env.SLACK_CHANNEL_ONBOARDING || '#onboarding';
            else if (channel === 'ops')
                targetChannel = process.env.SLACK_CHANNEL_OPS_ALERTS || '#ops-alerts';
            // Strip any potential literal quotes from env vars
            targetChannel = targetChannel.replace(/"/g, '');
            let blocks = [];
            let text = message;
            const baseContext = {
                type: 'context',
                elements: [{ type: 'mrkdwn', text: `Run ID: \`${context?.runId || 'N/A'}\` | 🕒 ${new Date().toISOString()}` }]
            };
            if (message.includes('Human Decision Required') || message.includes('Approve:')) {
                const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
                const url = urlMatch ? urlMatch[0] : `${process.env.BASE_URL}/hitl/unknown`;
                blocks = [
                    { type: 'header', text: { type: 'plain_text', text: '⚠️ Human Decision Required' } },
                    { type: 'section', text: { type: 'mrkdwn', text: message } },
                    { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Review' }, style: 'danger', url, action_id: 'hitl_review' }] },
                    baseContext
                ];
            }
            else if (message.toUpperCase().includes('CVE') || channel.includes('security')) {
                blocks = [
                    { type: 'header', text: { type: 'plain_text', text: `🔴 CVE Alert` } },
                    { type: 'section', text: { type: 'mrkdwn', text: message } },
                    baseContext
                ];
            }
            else if (channel.includes('risk') || message.includes('*Risk Alert*')) {
                const idMatch = message.match(/Flag:\s*`([^`]+)`/);
                const riskId = idMatch?.[1];
                blocks = [
                    { type: 'header', text: { type: 'plain_text', text: `⚠️ Risk Alert` } },
                    { type: 'section', text: { type: 'mrkdwn', text: message } },
                    ...(riskId ? [{
                            type: 'actions',
                            elements: [{
                                    type: 'button',
                                    text: { type: 'plain_text', text: 'Acknowledge' },
                                    style: 'primary',
                                    value: riskId,
                                    action_id: 'risk_acknowledge'
                                }]
                        }] : []),
                    baseContext
                ];
            }
            try {
                const response = await slack.chat.postMessage({
                    channel: targetChannel.startsWith('#') ? targetChannel : `#${targetChannel}`,
                    text,
                    blocks: blocks.length > 0 ? blocks : undefined
                });
                return { success: true, channel: response.channel, ts: response.ts };
            }
            catch (error) {
                console.error("Slack post failed", error);
                return { success: false, error: error.message };
            }
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'post_slack_file',
        description: 'Upload a file to a Slack channel.',
        schema: zod_1.z.object({ channel: zod_1.z.string(), filePath: zod_1.z.string(), initialComment: zod_1.z.string().optional() }),
        execute: async ({ channel, filePath, initialComment }, context) => {
            const isMock = process.env.MOCK_SLACK === 'true';
            if (isMock) {
                console.log(`[MOCK SLACK] Uploading ${filePath} to #${channel}`);
                return { success: true, channel, delivered: true };
            }
            try {
                const { WebClient } = await Promise.resolve().then(() => __importStar(require('@slack/web-api')));
                const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
                let targetChannel = channel;
                if (channel === 'security')
                    targetChannel = process.env.SLACK_CHANNEL_SECURITY || '#security-alerts';
                else if (channel === 'risk')
                    targetChannel = process.env.SLACK_CHANNEL_RISK || '#risk-alerts';
                else if (channel === 'onboarding')
                    targetChannel = process.env.SLACK_CHANNEL_ONBOARDING || '#onboarding';
                else if (channel === 'ops')
                    targetChannel = process.env.SLACK_CHANNEL_OPS_ALERTS || '#ops-alerts';
                targetChannel = targetChannel.replace(/"/g, '');
                if (!targetChannel.startsWith('#'))
                    targetChannel = `#${targetChannel}`;
                // Resolve name to ID if needed
                let finalChannelId = targetChannel;
                if (targetChannel.startsWith('#')) {
                    const list = await slack.conversations.list({ types: 'public_channel,private_channel', limit: 1000 });
                    const channelName = targetChannel.substring(1);
                    const found = list.channels?.find(c => c.name === channelName);
                    if (found?.id)
                        finalChannelId = found.id;
                }
                const fileStream = fs.createReadStream(filePath);
                // Use files.uploadV2 for better reliability in newer versions
                const response = await slack.files.uploadV2({
                    channel_id: finalChannelId,
                    file: fileStream,
                    filename: filePath.split('/').pop(),
                    initial_comment: initialComment
                });
                return { success: true, fileId: response.files?.[0]?.id };
            }
            catch (error) {
                console.error("Slack file upload failed", error);
                return { success: false, error: error.message };
            }
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'send_onboarding_email',
        description: 'Send an onboarding email packet to a new employee. Use only for onboarding.',
        schema: zod_1.z.object({ email: zod_1.z.string(), name: zod_1.z.string(), role: zod_1.z.string() }),
        execute: async ({ email, name, role }, context) => {
            const isMock = process.env.MOCK_SMTP === 'true';
            if (context) {
                await (0, transactions_1.logTransaction)({
                    runId: context.runId,
                    stepIndex: context.stepIndex,
                    operationType: 'EMAIL_SENT',
                    target: email,
                    inversePayload: { email_recalled: true }
                });
            }
            if (isMock) {
                return { success: true, email, delivered: true, timestamp: new Date().toISOString() };
            }
            try {
                const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
                const html = (0, templates_1.buildOnboardingEmailHtml)(name, role);
                const redirectEmail = process.env.EMAIL_REDIRECT_TO;
                const targetEmail = typeof redirectEmail === 'string' && redirectEmail.length > 0 ? redirectEmail : email;
                const { data, error } = await resend.emails.send({
                    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
                    to: targetEmail,
                    subject: `Welcome to FlowSentrix, ${name}!`,
                    html
                });
                if (error) {
                    console.error("Resend error:", error);
                    return { success: false, error: error.message };
                }
                await (0, ToolRegistry_2.executeTool)('post_slack', JSON.stringify({
                    channel: 'onboarding',
                    message: `✅ Onboarding email delivered for *${name}* (${role}) to \`${targetEmail}\``
                }), context);
                return { success: true, email: targetEmail, id: data?.id };
            }
            catch (error) {
                console.error("Email send failed", error);
                return { success: false, error: error.message };
            }
        }
    });
    (0, ToolRegistry_1.registerTool)({
        name: 'generate_hitl_token',
        description: 'Generate a unique token and URL for Human-In-The-Loop approval.',
        schema: zod_1.z.object({ hitlId: zod_1.z.string().optional() }),
        execute: async () => {
            const { randomUUID } = await Promise.resolve().then(() => __importStar(require('crypto')));
            const token = randomUUID();
            const hitlUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/hitl/${token}`;
            return { token, hitlUrl };
        }
    });
};
exports.registerAllTools = registerAllTools;
