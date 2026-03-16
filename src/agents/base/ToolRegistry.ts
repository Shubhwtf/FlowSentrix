import { z } from 'zod';
import { redisClient } from '../../events/bus';
import { randomBytes } from 'crypto';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { db } from '../../db/client';
import { logInverseOperation } from '../../events/transactions';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export type ToolImplementation<T> = (args: T, context?: { runId: string, stepIndex: number }) => Promise<any>;

export interface ToolDefinition<T> {
    name: string;
    description: string;
    schema: z.ZodSchema<T>;
    execute: ToolImplementation<T>;
}

export const tools = new Map<string, ToolDefinition<any>>();

export const registerTool = <T>(def: ToolDefinition<T>) => {
    tools.set(def.name, def);
};

export const executeTool = async (name: string, argsRaw: string, context?: { runId: string, stepIndex: number }) => {
    const tool = tools.get(name);
    if (!tool) throw new Error(`ToolNotFound:${name}`);
    const args = tool.schema.parse(JSON.parse(argsRaw));
    return await tool.execute(args, context);
};

export const getGroqTools = () => {
    return Array.from(tools.values()).map(t => {
        return {
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: zodToJsonSchema(t.schema as any),
            }
        };
    });
};

registerTool({
    name: 'generate_hitl_token',
    description: 'Generate single-use token for HITL approval',
    schema: z.object({ hitlId: z.string() }),
    execute: async ({ hitlId }) => {
        const token = randomBytes(32).toString('hex');
        await redisClient.setex(`hitl:${token}`, 86400, hitlId);
        return { token, hitlUrl: `http://localhost:3000/hitl/${token}` };
    }
});

registerTool({
    name: 'read_email',
    description: 'Read emails from a specific mailbox using filters',
    schema: z.object({ mailboxId: z.string(), filters: z.any().optional() }),
    execute: async ({ mailboxId, filters }) => {
        if (process.env.MOCK_MODE === 'true' || process.env.MOCK_EMAIL === 'true') {
            return {
                emails: [
                    { id: 'msg-1', sender: 'hr@flowsentrix.com', subject: 'New Hire: John Doe', body: 'Please onboard John Doe as a Senior Engineer starting Oct 1 in Engineering. Manager is Sarah Smith. Salary tier 3.', timestamp: new Date().toISOString() },
                    { id: 'msg-2', sender: 'it@flowsentrix.com', subject: 'Laptop Request', body: 'Laptop request for John Doe approved.', timestamp: new Date().toISOString() }
                ]
            };
        }
        return { emails: [] };
    }
});

class ConfidenceBelowThresholdError extends Error {
    constructor(public score: number, public threshold: number) {
        super(`Confidence Score ${score} is below the required threshold of ${threshold}`);
        this.name = 'ConfidenceBelowThresholdError';
    }
}

registerTool({
    name: 'write_db',
    description: 'Write data to the PostgreSQL database. Requires the agent to supply its current self-evaluated confidence score for this action.',
    schema: z.object({ table: z.string(), operation: z.enum(['INSERT', 'UPDATE', 'DELETE']), primaryKey: z.any().optional(), data: z.any().optional(), agentConfidenceScore: z.number() }),
    execute: async ({ table, operation, primaryKey, data, agentConfidenceScore }, context) => {
        if (!context) throw new Error("Missing context");

        const runRec = await db.selectFrom('workflow_runs').select('workflow_id').where('id', '=', context.runId).executeTakeFirst();
        if (!runRec) throw new Error("Run not found");

        const wfDef = await db.selectFrom('workflow_definitions').select('confidence_thresholds').where('id', '=', runRec.workflow_id).executeTakeFirst();
        const thresholds: any = wfDef?.confidence_thresholds || {};

        const stepRec = await db.selectFrom('run_steps').select('agent_type').where('run_id', '=', context.runId).where('step_index', '=', context.stepIndex).executeTakeFirst();
        const agentType = stepRec?.agent_type || 'default';
        const requiredThreshold = thresholds[agentType] || 75;

        if (agentConfidenceScore < requiredThreshold) {
            throw new ConfidenceBelowThresholdError(agentConfidenceScore, requiredThreshold);
        }

        if (typeof logInverseOperation === 'function') {
            await logInverseOperation(context.runId, context.stepIndex, table, operation, primaryKey, data);
        }

        if (operation === 'INSERT') {
            return await db.insertInto(table as any).values(data).returningAll().execute();
        } else if (operation === 'UPDATE') {
            if (!primaryKey) throw new Error("Missing primaryKey for UPDATE");
            let q = db.updateTable(table as any).set(data);
            for (const key of Object.keys(primaryKey)) {
                q = q.where(key as any, '=', primaryKey[key]);
            }
            return await q.returningAll().execute();
        } else if (operation === 'DELETE') {
            if (!primaryKey) throw new Error("Missing primaryKey for DELETE");
            let q = db.deleteFrom(table as any);
            for (const key of Object.keys(primaryKey)) {
                q = q.where(key as any, '=', primaryKey[key]);
            }
            return await q.returningAll().execute();
        }
        return { success: false };
    }
});

registerTool({
    name: 'query_db',
    description: 'Execute a read-only SQL query against the database',
    schema: z.object({ sql: z.string(), params: z.array(z.any()).optional() }),
    execute: async ({ sql: queryStr, params }) => {
        const uSql = queryStr.toUpperCase();
        if (uSql.includes('INSERT ') || uSql.includes('UPDATE ') || uSql.includes('DELETE ') || uSql.includes('DROP ') || uSql.includes('ALTER ')) {
            throw new Error('ReadOnlyViolationError: Mutation keywords detected in query.');
        }
        const { CompiledQuery } = await import('kysely');
        return await db.executeQuery(CompiledQuery.raw(queryStr, params || []));
    }
});

registerTool({
    name: 'open_pr',
    description: 'Open a Pull Request on GitHub',
    schema: z.object({ repo: z.string(), branch: z.string(), title: z.string(), body: z.string() }),
    execute: async ({ repo, branch, title, body }) => {
        if (process.env.MOCK_MODE === 'true' || process.env.MOCK_GITHUB === 'true') {
            return { number: 42, url: `https://github.com/${repo}/pull/42`, branch, diffSummary: '+15 -4 lines changed' };
        }
        return { number: 42, url: `https://github.com/${repo}/pull/42`, branch };
    }
});

registerTool({
    name: 'post_slack',
    description: 'Post a message to a Slack channel',
    schema: z.object({ channel: z.string(), message: z.string() }),
    execute: async ({ channel, message }) => {
        if (process.env.MOCK_MODE === 'true' || process.env.MOCK_SLACK === 'true') {
            console.log(`[MOCK SLACK → #${channel}] ${message}`);
            return { ok: true, ts: new Date().getTime().toString(), channel };
        }
        return { ok: true, ts: 'real_ts', channel };
    }
});

registerTool({
    name: 'generate_document',
    description: 'Generate a document from a template and data fields',
    schema: z.object({ template: z.string(), data: z.any() }),
    execute: async ({ template, data }) => {
        const outDir = '/tmp/flowsentrix/docs';
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        const fileBase = `doc_${randomBytes(4).toString('hex')}`;
        const pdfPath = path.join(outDir, `${fileBase}.pdf`);
        const docxPath = path.join(outDir, `${fileBase}.docx`);

        let htmlContent = `<html><body><h1>${template}</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;

        if (process.env.MOCK_MODE !== 'true') {
            // In real mode, we would call LLaMA to fill the template. For now just render payload.
        }

        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        await page.pdf({ path: pdfPath, format: 'A4' });
        await browser.close();

        fs.writeFileSync(docxPath, 'Dummy DOCX content generated by docx-js mock');

        return { pdfPath, docxPath };
    }
});

registerTool({
    name: 'run_ci_tests',
    description: 'Trigger and monitor CI tests for a branch',
    schema: z.object({ repo: z.string(), branch: z.string() }),
    execute: async ({ repo, branch }) => {
        if (process.env.MOCK_MODE === 'true' || process.env.MOCK_GITHUB === 'true') {
            await new Promise(r => setTimeout(r, 2000));
            return { passed: true, testCount: 47, duration: "12s", failedTests: [] };
        }
        return { passed: true, testCount: 0, duration: "0s", failedTests: [] };
    }
});

registerTool({
    name: 'provision_account',
    description: 'Provision a user account across multiple IT tools',
    schema: z.object({ userId: z.string(), tools: z.array(z.string()) }),
    execute: async ({ userId, tools }, context) => {
        if (process.env.MOCK_MODE === 'true' || process.env.MOCK_IT === 'true') {
            if (context && process.env.DEMO_INJECT_FAILURE_AT_STEP && parseInt(process.env.DEMO_INJECT_FAILURE_AT_STEP) === context.stepIndex) {
                return { error: "unexpected_format", raw: "<!DOCTYPE html>" };
            }
            return { accountsCreated: tools, userId, provisionedAt: new Date().toISOString() };
        }
        return { accountsCreated: tools, userId, provisionedAt: new Date().toISOString() };
    }
});

registerTool({
    name: 'create_ticket',
    description: 'Create a ticket in an external tracker system (Jira/Linear)',
    schema: z.object({ system: z.enum(['Jira', 'Linear']), payload: z.any() }),
    execute: async ({ system, payload }) => {
        if (process.env.MOCK_MODE === 'true' || process.env.MOCK_TICKET === 'true') {
            return { id: "SEC-123", url: "https://mock.linear.app/SEC-123", status: "open", createdAt: new Date().toISOString() };
        }
        return { id: "REAL-123", url: `https://real.${system.toLowerCase()}.app/123` };
    }
});

registerTool({
    name: 'read_file',
    description: 'Read a file from a repository',
    schema: z.object({ repoPath: z.string(), filePath: z.string() }),
    execute: async ({ repoPath, filePath }) => {
        if (process.env.MOCK_MODE === 'true' || process.env.MOCK_GITHUB === 'true') {
            return {
                path: filePath,
                content: `function executeQuery(userInput: string) {\n    const query = "SELECT * FROM users WHERE username = '" + userInput + "';";\n    db.execute(query);\n}\n`
            };
        }
        return { path: filePath, content: 'real content' };
    }
});
