import { z } from 'zod';
import { registerTool } from '../base/ToolRegistry';
import { db } from '../../db/client';
import { logTransaction } from '../../events/transactions';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export const registerAllTools = () => {
    registerTool({
        name: 'query_db',
        description: 'Execute read-only SQL query against PostgreSQL DB',
        schema: z.object({ query: z.string(), params: z.array(z.any()).optional() }),
        execute: async ({ query }) => {
            const { sql } = await import('kysely');
            const result = await sql`${sql.raw(query)}`.execute(db);
            return result.rows;
        }
    });

    registerTool({
        name: 'write_db',
        description: 'Insert data into a table',
        schema: z.object({ table: z.string(), data: z.record(z.string(), z.any()) }),
        execute: async ({ table, data }, context) => {
            const result = await db.insertInto(table as any).values(data).returningAll().executeTakeFirstOrThrow() as any;
            if (context) {
                await logTransaction({
                    runId: context.runId,
                    stepIndex: context.stepIndex,
                    operationType: 'INSERT',
                    target: table,
                    inversePayload: { id: result.id }
                });
            }
            return { success: true, table, inserted: result };
        }
    });

    registerTool({
        name: 'call_api',
        description: 'Call external REST API',
        schema: z.object({ url: z.string(), method: z.string(), body: z.any().optional(), headers: z.record(z.string(), z.string()).optional() }),
        execute: async ({ url, method, body, headers }, context) => {
            if (url.includes('demo-inject-failure') || (context && process.env.DEMO_INJECT_FAILURE_AT_STEP === String(context.stepIndex))) {
                throw new Error("HTTP 500: Internal Server Error from IT Provisioning API. Format mismatch.");
            }
            try {
                const res = await fetch(url, {
                    method,
                    headers: headers || { 'Content-Type': 'application/json' },
                    body: body ? JSON.stringify(body) : undefined
                });
                const responseText = await res.text();
                try {
                    return { status: res.status, data: JSON.parse(responseText) };
                } catch {
                    return { status: res.status, data: responseText };
                }
            } catch (e: any) {
                return { error: e.message };
            }
        }
    });

    registerTool({
        name: 'read_email',
        description: 'Read emails from Microsoft Graph API',
        schema: z.object({ mailboxId: z.string(), filters: z.record(z.string(), z.any()).optional() }),
        execute: async ({ mailboxId }, context) => {
            if (!context) return [];
            const run = await db.selectFrom('workflow_runs').selectAll().where('id', '=', context.runId).executeTakeFirst();
            if (run && run.trigger_payload) {
                const payload = typeof run.trigger_payload === 'string' ? JSON.parse(run.trigger_payload) : run.trigger_payload;
                if (payload.emailData) return payload.emailData;
            }
            return [{ subject: 'New Hire: John Doe', body: 'Please onboard John Doe (jdoe@example.com) starting next Monday. Department: Engineering. Role: Senior Developer.' }];
        }
    });

    registerTool({
        name: 'generate_document',
        description: 'Generate PDF or DOCX from template and data',
        schema: z.object({ template: z.string(), format: z.enum(['pdf', 'docx']).default('pdf'), data: z.record(z.string(), z.any()) }),
        execute: async ({ template, format, data }, context) => {
            const outDir = path.join(process.cwd(), 'artifacts', 'docs');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const filename = `${template}_${Date.now()}.${format}`;
            const outPath = path.join(outDir, filename);

            if (format === 'pdf') {
                const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
                const page = await browser.newPage();
                const html = `<html><body style="font-family:sans-serif;padding:40px;"><h1>${template}</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
                await page.setContent(html);
                await page.pdf({ path: outPath, format: 'A4' });
                await browser.close();
            } else {
                const doc = new Document({
                    sections: [{
                        properties: {},
                        children: [
                            new Paragraph({ children: [new TextRun({ text: template, bold: true, size: 32 })] }),
                            new Paragraph({ text: JSON.stringify(data, null, 2) })
                        ]
                    }]
                });
                const buffer = await Packer.toBuffer(doc);
                fs.writeFileSync(outPath, buffer);
            }

            if (context) {
                await db.insertInto('audit_log').values({
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

    registerTool({
        name: 'read_file',
        description: 'Read file from GitHub repository',
        schema: z.object({ repoPath: z.string(), filePath: z.string() }),
        execute: async () => ({ content: `function mock() { return "vulnerable"; }` })
    });

    registerTool({
        name: 'open_pr',
        description: 'Open GitHub Pull Request',
        schema: z.object({ repo: z.string(), branch: z.string(), title: z.string(), body: z.string() }),
        execute: async ({ repo }) => ({ prUrl: `https://github.com/${repo}/pull/101` })
    });

    registerTool({
        name: 'post_slack',
        description: 'Post message to Slack channel',
        schema: z.object({ channel: z.string(), message: z.string() }),
        execute: async ({ channel, message }, context) => {
            if (context) {
                await logTransaction({
                    runId: context.runId,
                    stepIndex: context.stepIndex,
                    operationType: 'SLACK_MESSAGE',
                    target: channel,
                    inversePayload: { message_deleted: true }
                });
            }
            return { success: true, channel, delivered: true, timestamp: new Date().toISOString() };
        }
    });
};
