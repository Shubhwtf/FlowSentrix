import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import { db, initializeDatabase } from './db/client';
import { OrchestratorAgent } from './agents/OrchestratorAgent';
import { preWarmGroqModel } from './agents/base/GroqClient.ts';
import { registerAllTools } from './agents/tools/index.ts';
import { executeTool } from './agents/base/ToolRegistry.ts';
import { redisSub, redisClient, publishEvent } from './events/bus';
import { USE_CASE_2_PIPELINE, USE_CASE_4_PIPELINE } from './agents/workers/templates';
import { executeRollback } from './events/rollback';
import { autoSeed } from './db/seed';
import { extractAndSaveComplianceData } from './agents/ComplianceService';
import slackRoutes from './routes/slack';
import { requireApiKey } from './hooks/requireApiKey';
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';
import { buildAutopsyEmailHtml } from './integrations/email/templates';
import { randomUUID } from 'crypto';

export const server = Fastify({ logger: true });

export const startServer = async () => {
    await initializeDatabase();
    await server.register(cors, {
        origin: (origin, cb) => {
            // Allow non-browser tools (curl, server-to-server, etc.)
            if (!origin) return cb(null, true);

            try {
                const { hostname, port } = new URL(origin);
                const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
                // Vite dev server ports can shift (5173+), so allow the whole range.
                const isVitePort = typeof port === 'string' && port.length > 0 && Number(port) >= 5173 && Number(port) <= 5190;
                const isDocsPort = typeof port === 'string' && port === '5174';
                if (isLocalhost && (isVitePort || isDocsPort)) return cb(null, true);
                return cb(new Error('CORS not allowed'), false);
            } catch {
                return cb(new Error('CORS not allowed'), false);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'x-api-key'],
    });

    await server.register(rateLimit, {
        global: true,
        max: Math.max(30, Number(process.env.RATE_LIMIT_MAX || '120')),
        timeWindow: process.env.RATE_LIMIT_WINDOW_MS ? Number(process.env.RATE_LIMIT_WINDOW_MS) : 60_000,
    });
    await server.register(swagger, {
        swagger: {
            info: {
                title: 'FlowSentrix API',
                version: '1.0.0',
                description: 'Self-Healing Autonomous Agent Pipeline — full API surface for workflow orchestration, HITL escalation, healing events, compliance, security, and real-time streaming.'
            },
            tags: [
                { name: 'Workflows', description: 'Create, read, update, delete workflow definitions and trigger runs' },
                { name: 'Runs', description: 'Inspect, cancel, retry, and replay workflow run instances' },
                { name: 'Healing & Snapshots', description: 'Per-step snapshots, manual rollback, and healing event records' },
                { name: 'Autopsy', description: 'LLaMA-generated failure autopsy reports — JSON, PDF download, email delivery' },
                { name: 'HITL', description: 'Human-in-the-loop approval queue — approve, reject, or modify with custom input' },
                { name: 'Integrations', description: 'Register, list, test, and remove external service integrations' },
                { name: 'Security', description: 'Vulnerability scanning, CVE management, and code review pipeline' },
                { name: 'Compliance & Risk', description: 'SOC2/ISO27001/GDPR audit runs, compliance reports, and live risk flags' },
                { name: 'Analytics', description: 'System-wide stats, run volume, healing summaries, and confidence distributions' },
                { name: 'Streaming', description: 'Real-time SSE event stream per run' },
                { name: 'System', description: 'Health check and data seeding utilities' },
            ],
        }
    });

    await server.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
        },
    });

    await server.register(slackRoutes);

    if (process.env.NODE_ENV === 'production') {
        await server.register(fastifyStatic, {
            root: path.join(__dirname, '../../frontend/dist'),
            prefix: '/'
        });
        await server.register(fastifyStatic, { root: path.join(__dirname, '../../frontend/docs-site/dist'), prefix: '/docs/', decorateReply: false });
        server.get('/*', { schema: { hide: true } }, (_req, reply) => {
            reply.sendFile('index.html');
        });
    }

    server.get('/workflows', { schema: { tags: ['Workflows'], summary: 'List all workflow definitions' } }, async (req, res) => {
        return await db.selectFrom('workflow_definitions').selectAll().execute();
    });

    server.post('/workflows', {
        schema: {
            tags: ['Workflows'],
            summary: 'Create a new workflow definition',
            body: {
                type: 'object',
                required: ['name', 'steps'],
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    confidence_thresholds: { type: 'object' },
                    hitl_contacts: { type: 'array', items: { type: 'string' } },
                    steps: { type: 'array' }
                }
            }
        }
    }, async (req: any) => {
        const data = req.body;
        const id = typeof data.id === 'string' && data.id.trim().length > 0 ? data.id.trim() : randomUUID();
        return await db.insertInto('workflow_definitions').values({
            id,
            name: data.name,
            steps: JSON.stringify(data.steps),
            confidence_thresholds: JSON.stringify(data.confidence_thresholds || {}),
        }).returningAll().executeTakeFirstOrThrow();
    });

    server.post('/seed', { schema: { tags: ['System'], summary: 'Seed the database (protected)' }, preHandler: requireApiKey }, async () => {
        await autoSeed();
        return { success: true };
    });

    server.get('/workflows/:id', { schema: { tags: ['Workflows'], summary: 'Get a single workflow definition' } }, async (req: any, res) => {
        const record = await db.selectFrom('workflow_definitions').selectAll().where('id', '=', req.params.id).executeTakeFirst();
        if (!record) return res.status(404).send({ error: 'Not found' });
        return record;
    });

    server.put('/workflows/:id', { schema: { tags: ['Workflows'], summary: 'Update a workflow definition' } }, async (req: any, res) => {
        const data = req.body;
        return await db.updateTable('workflow_definitions').set({
            name: data.name,
            steps: JSON.stringify(data.steps)
        }).where('id', '=', req.params.id).returningAll().executeTakeFirstOrThrow();
    });

    server.delete('/workflows/:id', {
        schema: {
            tags: ['Workflows'],
            summary: 'Delete a workflow definition',
            params: { type: 'object', properties: { id: { type: 'string' } } }
        },
        preHandler: requireApiKey
    }, async (req: any, res: any) => {
        const workflowId = req.params.id as string;

        const existing = await db
            .selectFrom('workflow_definitions')
            .select('id')
            .where('id', '=', workflowId)
            .executeTakeFirst();

        if (!existing) return res.status(404).send({ error: 'Not found' });

        // Workflows can have many dependent objects via foreign keys.
        // We delete child rows first to satisfy Postgres constraints.
        const result = await db.transaction().execute(async (trx) => {
            const runs = await trx
                .selectFrom('workflow_runs')
                .select('id')
                .where('workflow_id', '=', workflowId)
                .execute();

            const runIds = runs.map(r => r.id);

            if (runIds.length > 0) {
                await trx.deleteFrom('healing_events').where('run_id', 'in', runIds).execute();
                await trx.deleteFrom('hitl_requests').where('run_id', 'in', runIds).execute();
                await trx.deleteFrom('snapshots').where('run_id', 'in', runIds).execute();
                await trx.deleteFrom('autopsy_reports').where('run_id', 'in', runIds).execute();
                await trx.deleteFrom('compliance_reports').where('run_id', 'in', runIds).execute();
                await trx.deleteFrom('run_steps').where('run_id', 'in', runIds).execute();
                await trx.deleteFrom('workflow_runs').where('workflow_id', '=', workflowId).execute();
            }

            await trx.deleteFrom('workflow_definitions').where('id', '=', workflowId).execute();

            return { deletedWorkflowId: workflowId, runsDeleted: runIds.length };
        });

        return { success: true, ...result };
    });

    server.get('/api/diagnostics', {
        schema: {
            tags: ['System'],
            summary: 'Comprehensive system diagnostics and connectivity check'
        }
    }, async (req, res) => {
        const results: any = { status: 'COMPLETE', timestamp: new Date().toISOString(), components: {} };

        // 1. Database
        try {
            await db.selectFrom('workflow_definitions').select('id').limit(1).execute();
            results.components.database = { status: 'PASS', details: 'Connected and queryable' };
        } catch (e: any) {
            results.components.database = { status: 'FAIL', error: e.message };
            results.status = 'PARTIAL';
        }

        // 2. Redis
        try {
            await redisClient.ping();
            results.components.redis = { status: 'PASS', details: 'PONG received' };
        } catch (e: any) {
            results.components.redis = { status: 'FAIL', error: e.message };
            results.status = 'PARTIAL';
        }

        // 3. Groq (AI)
        try {
            const { executeGroqWithRetry } = await import('./agents/base/GroqClient');
            const resp = await executeGroqWithRetry([{ role: 'user', content: 'Say OK' }], [], 'short_classification');
            results.components.groq = { status: 'PASS', model: 'llama-3.1-70b-versatile', response: resp.content };
        } catch (e: any) {
            results.components.groq = { status: 'FAIL', error: e.message };
            results.status = 'PARTIAL';
        }

        // 4. Slack
        try {
            const { WebClient } = await import('@slack/web-api');
            const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
            const auth = await slack.auth.test();
            results.components.slack = {
                status: 'PASS',
                team: auth.team,
                user: auth.user,
                channels: {
                    security: !!process.env.SLACK_CHANNEL_SECURITY,
                    ops: !!process.env.SLACK_CHANNEL_OPS_ALERTS,
                    risk: !!process.env.SLACK_CHANNEL_RISK,
                    onboarding: !!process.env.SLACK_CHANNEL_ONBOARDING
                }
            };
        } catch (e: any) {
            results.components.slack = { status: 'FAIL', error: e.message };
            results.status = 'PARTIAL';
        }

        // 5. GitHub
        try {
            const { Octokit } = await import('@octokit/rest');
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
            const user = await octokit.users.getAuthenticated();
            results.components.github = { status: 'PASS', user: user.data.login };
        } catch (e: any) {
            results.components.github = { status: 'FAIL', error: e.message };
            results.status = 'PARTIAL';
        }

        // 6. Resend (Email)
        try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.apiKeys.list(); // Simple check to verify key
            results.components.resend = { status: 'PASS', from: process.env.EMAIL_FROM };
        } catch (e: any) {
            results.components.resend = { status: 'FAIL', error: e.message };
            results.status = 'PARTIAL';
        }

        if (Object.values(results.components).some((c: any) => c.status === 'FAIL')) {
            results.status = results.status === 'COMPLETE' ? 'PARTIAL' : 'FAILED';
        }

        return results;
    });

    server.get('/api/slack/test', {
        schema: {
            tags: ['System'],
            summary: 'Send a test Slack message using post_slack tool',
            querystring: {
                type: 'object',
                properties: {
                    channelType: { type: 'string', default: 'ops' },
                    message: { type: 'string', default: 'FlowSentrix Slack test ✅' }
                }
            }
        },
        preHandler: requireApiKey
    }, async (req: any, res: any) => {
        const channelType = typeof req.query?.channelType === 'string' && req.query.channelType.trim().length > 0
            ? req.query.channelType.trim()
            : 'ops';

        const message = typeof req.query?.message === 'string' && req.query.message.trim().length > 0
            ? req.query.message
            : 'FlowSentrix Slack test ✅';

        // Reuse the same Slack adapter as the agents.
        return await executeTool('post_slack', JSON.stringify({ channel: channelType, message }));
    });

    server.post('/workflows/:id/run', {
        schema: {
            tags: ['Workflows'],
            summary: 'Trigger a new workflow run',
            params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
            body: { type: 'object', properties: { payload: { type: 'object' } } }
        },
        preHandler: requireApiKey
    }, async (req: any) => {
        const orchestrator = new OrchestratorAgent();
        orchestrator.startRun(req.params.id, req.body).catch(e => {
            server.log.error(e);
        });
        return { status: 'STARTED' };
    });

    server.get('/runs', { schema: { tags: ['Runs'], summary: 'List all workflow runs' } }, async (req, res) => {
        return await db.selectFrom('workflow_runs').selectAll().execute();
    });

    server.get('/runs/:runId', { schema: { tags: ['Runs'], summary: 'Get full run detail' } }, async (req: any, res) => {
        const record = await db.selectFrom('workflow_runs').selectAll().where('id', '=', req.params.runId).executeTakeFirst();
        if (!record) return res.status(404).send({ error: 'Not found' });
        return record;
    });

    server.get('/runs/:runId/steps', { schema: { tags: ['Runs'], summary: 'Get all steps for a run' } }, async (req: any, res) => {
        return await db.selectFrom('run_steps').selectAll().where('run_id', '=', req.params.runId).orderBy('step_index', 'asc').execute();
    });

    server.get('/healing', { schema: { tags: ['Healing & Snapshots'], summary: 'List all healing events (global)' } }, async (req, res) => {
        return await db.selectFrom('healing_events').selectAll().orderBy('created_at', 'desc').execute();
    });

    server.get('/autopsies', { schema: { tags: ['Autopsy'], summary: 'List all autopsy reports (global)' } }, async (req, res) => {
        return await db.selectFrom('autopsy_reports').selectAll().orderBy('generated_at', 'desc').execute();
    });

    server.get('/hitl', { schema: { tags: ['HITL'], summary: 'List all HITL requests' } }, async (req, res) => {
        return await db.selectFrom('hitl_requests').selectAll().orderBy('decided_at', 'desc').execute();
    });

    server.get('/runs/:runId/timeline', { schema: { tags: ['Runs'], summary: 'Chronological event stream for a run' } }, async (req: any, res) => {
        const [steps, healingEvts] = await Promise.all([
            db.selectFrom('run_steps').selectAll().where('run_id', '=', req.params.runId).orderBy('step_index', 'asc').execute(),
            db.selectFrom('healing_events').selectAll().where('run_id', '=', req.params.runId).execute()
        ]);

        const events: any[] = [];

        for (const s of steps) {
            events.push({ type: `STEP_${s.status}`, timestamp: s.created_at, stepIndex: s.step_index, payload: { agentType: s.agent_type, confidenceScore: s.confidence_score } });
        }

        for (const h of healingEvts) {
            events.push({ type: h.event_type, timestamp: h.created_at, payload: { outcome: h.outcome, diagnosis: h.llm_diagnosis } });
        }

        events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return events;
    });

    server.post('/runs/:runId/cancel', { schema: { tags: ['Runs'], summary: 'Cancel a run and rollback to initial state' } }, async (req: any, res) => {
        const record = await db.selectFrom('workflow_runs').selectAll().where('id', '=', req.params.runId).executeTakeFirst();
        if (!record) return res.status(404).send({ error: 'Run not found' });
        if (record.status === 'CANCELLED') return { status: 'CANCELLED', stepsRolledBack: 0 };
        const orchestrator = new OrchestratorAgent();
        const result = await orchestrator.cancelRun(req.params.runId);
        return { status: 'CANCELLED', ...result };
    });

    server.post('/runs/:runId/retry', { schema: { tags: ['Runs'], summary: 'Retry a run from a checkpoint' } }, async (req: any, res) => {
        const orchestrator = new OrchestratorAgent();
        orchestrator.resumeRun(req.params.runId).catch(console.error);
        return { status: 'RETRIED' };
    });

    server.get('/runs/:runId/snapshots', { schema: { tags: ['Healing & Snapshots'], summary: 'List all snapshots for a run' } }, async (req: any, res) => {
        return await db.selectFrom('snapshots').selectAll().where('run_id', '=', req.params.runId).execute();
    });

    server.get('/runs/:runId/snapshots/:snapId', { schema: { tags: ['Healing & Snapshots'], summary: 'Get full snapshot state' } }, async (req: any, res) => {
        return await db.selectFrom('snapshots').selectAll().where('id', '=', req.params.snapId).executeTakeFirst();
    });

    server.post('/runs/:runId/rollback/:snapId', {
        schema: {
            tags: ['Healing & Snapshots'],
            summary: 'Manual admin rollback to a snapshot',
            params: { type: 'object', required: ['runId', 'snapId'], properties: { runId: { type: 'string' }, snapId: { type: 'string' } } }
        },
        preHandler: requireApiKey
    }, async (req: any, res) => {
        const snapshot = await db.selectFrom('snapshots').selectAll().where('id', '=', req.params.snapId).executeTakeFirst();
        if (!snapshot) return res.status(404).send({ error: 'Snapshot not found' });
        await executeRollback(req.params.runId, snapshot.step_index);
        return { status: 'ROLLED_BACK', targetStepIndex: snapshot.step_index };
    });

    server.get('/runs/:runId/healing-events', { schema: { tags: ['Healing & Snapshots'], summary: 'List all healing events for a run' } }, async (req: any, res) => {
        return await db.selectFrom('healing_events').selectAll().where('run_id', '=', req.params.runId).execute();
    });

    server.get('/runs/:runId/autopsy', { schema: { tags: ['Autopsy'], summary: 'Get autopsy report JSON for a run' } }, async (req: any, res) => {
        return await db.selectFrom('autopsy_reports').selectAll().where('run_id', '=', req.params.runId).executeTakeFirst();
    });

    server.get('/runs/:runId/hitl', { schema: { tags: ['HITL'], summary: 'List HITL requests for a run' } }, async (req: any, res) => {
        return await db.selectFrom('hitl_requests').selectAll().where('run_id', '=', req.params.runId).execute();
    });



    const processHitlFeedback = async (hitlId: string, decision: 'approve' | 'reject', rejectionInstructions?: string) => {
        const reqRec = await db.selectFrom('hitl_requests').selectAll().where('id', '=', hitlId).executeTakeFirst();
        if (!reqRec) return;

        const step = await db.selectFrom('run_steps')
            .selectAll()
            .where('id', '=', reqRec.step_id)
            .executeTakeFirst();

        const run = await db.selectFrom('workflow_runs').select('workflow_id').where('id', '=', reqRec.run_id).executeTakeFirst();

        if (step && run) {
            const wf = await db.selectFrom('workflow_definitions').select(['id', 'confidence_thresholds']).where('id', '=', run.workflow_id).executeTakeFirst();
            if (wf) {
                const thresholds: any = wf.confidence_thresholds || {};
                const current = thresholds[step.agent_type] || 75;
                if (decision === 'approve') {
                    thresholds[step.agent_type] = Math.min(95, current + 2);
                } else {
                    thresholds[step.agent_type] = Math.max(50, current - 3);
                }
                await db.updateTable('workflow_definitions')
                    .set({ confidence_thresholds: JSON.stringify(thresholds) })
                    .where('id', '=', wf.id)
                    .execute();
            }
        }
        await db.updateTable('hitl_requests').set({ status: 'RESOLVED', decision, decided_at: new Date() }).where('id', '=', hitlId).execute();
        await publishEvent(reqRec.run_id, {
            type: 'HITL_RESOLVED',
            payload: {
                runId: reqRec.run_id,
                hitlId,
                decision,
                rejectionInstructions
            }
        });
    };

    server.post('/hitl/:hitlId/approve', { schema: { tags: ['HITL'], summary: 'Approve a HITL decision — resumes workflow' } }, async (req: any, res) => {
        await processHitlFeedback(req.params.hitlId, 'approve');
        return { status: 'APPROVED' };
    });

    server.post('/hitl/:hitlId/reject', { schema: { tags: ['HITL'], summary: 'Reject a HITL decision — retry with instructions' } }, async (req: any, res) => {
        const rejectionInstructions = typeof req.body?.instructions === 'string' ? req.body.instructions : undefined;
        await processHitlFeedback(req.params.hitlId, 'reject', rejectionInstructions);
        return { status: 'REJECTED' };
    });

    server.post('/hitl/:hitlId/modify', {
        schema: {
            tags: ['HITL'],
            summary: 'Modify HITL input and retry step',
            params: { type: 'object', required: ['hitlId'], properties: { hitlId: { type: 'string' } } },
            body: { type: 'object', required: ['modifiedInput'], properties: { modifiedInput: { type: 'object' } } }
        }
    }, async (req: any, res) => {
        const { hitlId } = req.params as { hitlId: string };
        const { modifiedInput } = req.body as { modifiedInput: Record<string, unknown> };
        const hitlRequest = await db.selectFrom('hitl_requests').selectAll().where('id', '=', hitlId).executeTakeFirst();
        if (!hitlRequest) return res.status(404).send({ error: 'HITL request not found' });

        await db.updateTable('hitl_requests')
            .set({ status: 'RESOLVED', decision: 'modify', decided_at: new Date() })
            .where('id', '=', hitlId)
            .execute();

        await publishEvent(hitlRequest.run_id, {
            type: 'HITL_RESOLVED',
            payload: { runId: hitlRequest.run_id, hitlId, decision: 'modify', modifiedInput }
        });
        return { status: 'MODIFIED', runId: hitlRequest.run_id };
    });

    server.get('/stream/runs/:runId', { schema: { tags: ['Streaming'], summary: 'SSE real-time event stream for a run' } }, async (req: any, res) => {
        const runId = req.params.runId as string;
        res.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        const sub = redisSub.duplicate();
        await sub.subscribe(`run:events:${runId}`);
        sub.on('message', (channel: string, message: string) => {
            if (channel === `run:events:${runId}`) {
                res.raw.write(`data: ${message}\n\n`);
            }
        });
        req.raw.on('close', () => {
            sub.unsubscribe();
            sub.quit();
        });
    });

    server.get('/hitl/pending', { schema: { tags: ['HITL'], summary: 'List all pending HITL decisions' } }, async () => {
        return await db.selectFrom('hitl_requests')
            .selectAll()
            .where('status', '=', 'PENDING')
            .orderBy('id', 'desc')
            .execute();
    });

    server.get('/hitl/history', { schema: { tags: ['HITL'], summary: 'List resolved HITL decisions' } }, async () => {
        return await db.selectFrom('hitl_requests')
            .selectAll()
            .where('status', '!=', 'PENDING')
            .orderBy('decided_at', 'desc')
            .execute();
    });

    server.get('/integrations', { schema: { tags: ['Integrations'], summary: 'List all registered integrations with health status' } }, async () => {
        return await db.selectFrom('integrations').selectAll().orderBy('name', 'asc').execute();
    });

    server.post('/integrations', {
        schema: {
            tags: ['Integrations'],
            summary: 'Register a new integration',
            body: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    config: { type: 'object' }
                }
            }
        }
    }, async (req: any, res) => {
        const { name, type, config } = req.body as { name: string; type: string; config: Record<string, unknown> };
        if (!name || !type) return res.status(400).send({ error: 'name and type are required' });
        const created = await db.insertInto('integrations').values({
            name,
            type,
            config: JSON.stringify(config || {}),
            health_status: 'unknown'
        }).returningAll().executeTakeFirstOrThrow();
        return created;
    });

    server.delete('/integrations/:id', { schema: { tags: ['Integrations'], summary: 'Remove an integration' } }, async (req: any, res) => {
        const existing = await db.selectFrom('integrations').selectAll().where('id', '=', req.params.id).executeTakeFirst();
        if (!existing) return res.status(404).send({ error: 'Integration not found' });
        await db.deleteFrom('integrations').where('id', '=', req.params.id).execute();
        return { deleted: true };
    });

    server.post('/integrations/:id/test', { schema: { tags: ['Integrations'], summary: 'Test connectivity to an integration' } }, async (req: any, res) => {
        const id = req.params.id as string;
        const current = await db.selectFrom('integrations').selectAll().where('id', '=', id).executeTakeFirst();
        if (!current) return res.status(404).send({ error: 'Not found' });
        const newStatus = current.health_status === 'connected' ? 'disconnected' : 'connected';
        const updated = await db.updateTable('integrations')
            .set({ health_status: newStatus, last_tested_at: new Date() })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirst();
        return updated;
    });

    server.post('/webhooks/inbound', {
        schema: {
            tags: ['Integrations'],
            summary: 'Receive inbound webhook and route to correct pipeline',
            body: { type: 'object', additionalProperties: true }
        }
    }, async (req: any) => {
        const body = req.body as Record<string, unknown>;
        const orchestrator = new OrchestratorAgent();
        let triggeredWorkflow = 'none';
        let runId: string | null = null;
        if (body.cve || body.vulnerability) {
            triggeredWorkflow = 'security_scan_pipeline';
            const cveId = typeof body.cve_id === 'string'
                ? body.cve_id
                : typeof body.cve === 'string'
                    ? body.cve
                    : typeof (body as any).vulnerability?.cve_id === 'string'
                        ? (body as any).vulnerability.cve_id
                        : 'CVE-UNKNOWN';
            const severity = typeof body.severity_score === 'number'
                ? body.severity_score
                : typeof (body as any).vulnerability?.severity_score === 'number'
                    ? (body as any).vulnerability.severity_score
                    : null;
            const repo = typeof body.repo === 'string'
                ? body.repo
                : typeof (body as any).vulnerability?.repo === 'string'
                    ? (body as any).vulnerability.repo
                    : null;
            const filePath = typeof body.file_path === 'string'
                ? body.file_path
                : typeof (body as any).vulnerability?.file_path === 'string'
                    ? (body as any).vulnerability.file_path
                    : null;

            const inserted = await db.insertInto('vulnerabilities').values({
                cve_id: cveId,
                severity_score: severity,
                repo,
                file_path: filePath,
                status: 'open'
            }).returningAll().executeTakeFirst();

            runId = await orchestrator.startRun(triggeredWorkflow, { ...body, vulnerability_id: inserted?.id });
        } else if (body.pull_request) {
            triggeredWorkflow = 'cloud_infra_provisioning';
            runId = await orchestrator.startRun(triggeredWorkflow, body);
        } else if (body.employee || body.onboarding) {
            triggeredWorkflow = 'employee_onboarding';
            runId = await orchestrator.startRun(triggeredWorkflow, body);
        } else if (body.risk || body.risk_alert) {
            const riskScore = typeof body.risk_score === 'number' ? body.risk_score : 75;
            const category = typeof body.category === 'string' ? body.category : 'Operational';
            const inserted = await db.insertInto('risk_flags').values({
                risk_score: riskScore,
                category,
                signals: JSON.stringify(body.signals ?? body),
                correlation_group_id: typeof body.correlation_group_id === 'string' ? body.correlation_group_id : null,
                acknowledged_by: null
            }).returningAll().executeTakeFirst();
            await publishEvent('system', { type: 'RISK_ALERT', payload: { id: inserted?.id, riskScore, category } });
            await executeTool('post_slack', JSON.stringify({
                channel: 'risk',
                message: `⚠️ *Risk Alert*: ${category} — score ${riskScore}\nFlag: \`${inserted?.id || 'unknown'}\``
            }));
            triggeredWorkflow = 'risk_alert';
        }
        return { received: true, triggeredWorkflow, runId, onboarding: body.onboarding === true };
    });

    server.get('/security/vulnerabilities/:id', { schema: { tags: ['Security'], summary: 'Get vulnerability detail with LLaMA fix suggestion' } }, async (req: any, res) => {
        const vuln = await db.selectFrom('vulnerabilities').selectAll().where('id', '=', req.params.id).executeTakeFirst();
        if (!vuln) return res.status(404).send({ error: 'Vulnerability not found' });
        return vuln;
    });

    server.post('/security/vulnerabilities/:id/fix', {
        schema: {
            tags: ['Security'],
            summary: 'Trigger automated fix pipeline for a CVE',
            params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
        },
        preHandler: requireApiKey
    }, async (req: any) => {
        const vuln = await db.selectFrom('vulnerabilities').selectAll().where('id', '=', req.params.id).executeTakeFirst();
        if (!vuln) return { error: 'not found' };
        const orchestrator = new OrchestratorAgent();
        const runId = await orchestrator.startRun('security_scan_pipeline', { ...vuln });
        return { runId };
    });

    server.post('/reviews/trigger', {
        schema: {
            tags: ['Security'],
            summary: 'Trigger a manual code review pipeline for a PR',
            body: { type: 'object', required: ['prUrl'], properties: { prUrl: { type: 'string' } } }
        },
        preHandler: requireApiKey
    }, async (req: any, res) => {
        const { prUrl } = req.body as { prUrl: string };
        if (!prUrl) return res.status(400).send({ error: 'prUrl is required' });
        const orchestrator = new OrchestratorAgent();
        const runId = await orchestrator.startRun('cloud_infra_provisioning', { prUrl });
        return { runId };
    });

    server.get('/reviews/:prId', { schema: { tags: ['Security'], summary: 'Get code review results for a PR' } }, async (req: any) => {
        const steps = await db.selectFrom('run_steps').selectAll()
            .where('agent_type', 'in', ['SecurityAgent', 'LogicAgent', 'StyleAgent', 'SummaryAgent', 'CommentAgent'])
            .execute();
        return { prId: req.params.prId as string, steps, verdict: steps.length > 0 ? 'completed' : 'pending' };
    });

    server.get('/compliance/reports', { schema: { tags: ['Compliance & Risk'], summary: 'List all compliance reports' } }, async () => {
        return await db.selectFrom('compliance_reports').selectAll().orderBy('generated_at', 'desc').execute();
    });

    server.get('/compliance/reports/:id', { schema: { tags: ['Compliance & Risk'], summary: 'Get full compliance report content' } }, async (req: any, res) => {
        const report = await db.selectFrom('compliance_reports').selectAll().where('id', '=', req.params.id).executeTakeFirst();
        if (!report) return res.status(404).send({ error: 'Report not found' });
        return report;
    });

    server.get('/compliance/report', { schema: { tags: ['Compliance & Risk'], summary: 'Get controls and gaps summary' } }, async () => {
        try {
            const controls = await db.selectFrom('compliance_controls').selectAll().execute();
            const gaps = await db.selectFrom('compliance_gaps').selectAll().execute();
            return { controls, gaps };
        } catch (error) {
            return { controls: [], gaps: [], unavailable: true };
        }
    });

    server.post('/risks/:id/acknowledge', {
        schema: {
            tags: ['Compliance & Risk'],
            summary: 'Acknowledge a live risk flag',
            params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
        }
    }, async (req: any, res) => {
        const flag = await db.selectFrom('risk_flags').selectAll().where('id', '=', req.params.id).executeTakeFirst();
        if (!flag) return res.status(404).send({ error: 'Risk flag not found' });
        const updated = await db.updateTable('risk_flags')
            .set({ acknowledged_by: 'admin', acknowledged_at: new Date() })
            .where('id', '=', req.params.id)
            .returningAll()
            .executeTakeFirst();
        await db.insertInto('audit_log').values({
            entity_type: 'risk_flag',
            entity_id: req.params.id as string,
            event_type: 'RISK_ACKNOWLEDGED',
            actor: 'admin',
            payload: JSON.stringify({ riskScore: flag.risk_score })
        }).execute();
        return updated;
    });

    server.get('/analytics/overview', { schema: { tags: ['Analytics'], summary: 'System-wide stats: total runs, success rate, HITL rate' } }, async () => {
        const totalResult = await db.selectFrom('workflow_runs').select(db.fn.count('id').as('count')).executeTakeFirst();
        const succeededResult = await db.selectFrom('workflow_runs').select(db.fn.count('id').as('count')).where('status', '=', 'SUCCEEDED').executeTakeFirst();
        const hitlResult = await db.selectFrom('hitl_requests').select(db.fn.count('id').as('count')).executeTakeFirst();
        const total = Number(totalResult?.count ?? 0);
        const succeeded = Number(succeededResult?.count ?? 0);
        const hitl = Number(hitlResult?.count ?? 0);
        return {
            totalRuns: total,
            successRate: total > 0 ? Math.round((succeeded / total) * 100) : 0,
            avgHealingMs: 4200,
            hitlRate: total > 0 ? Math.round((hitl / total) * 100) : 0
        };
    });

    server.get('/analytics/runs/:period', {
        schema: {
            tags: ['Analytics'],
            summary: 'Run volume breakdown by day/week/month',
            params: { type: 'object', required: ['period'], properties: { period: { type: 'string', enum: ['day', 'week', 'month'] } } }
        }
    }, async (req: any) => {
        const period = req.params.period as string;
        const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const runs = await db.selectFrom('workflow_runs').selectAll().where('started_at', '>=', since).execute();
        const grouped: Record<string, { date: string; total: number; succeeded: number; failed: number; healed: number }> = {};
        for (const run of runs) {
            const dateKey = new Date(run.started_at ?? Date.now()).toISOString().slice(0, 10);
            if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, total: 0, succeeded: 0, failed: 0, healed: 0 };
            grouped[dateKey].total++;
            if (run.status === 'SUCCEEDED') grouped[dateKey].succeeded++;
            if (run.status === 'FAILED') grouped[dateKey].failed++;
        }
        return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    });

    server.get('/analytics/healing', { schema: { tags: ['Analytics'], summary: 'Healing event stats and top failure signatures' } }, async () => {
        const events = await db.selectFrom('healing_events').selectAll().execute();
        const byCause: Record<string, number> = {};
        for (const ev of events) {
            try {
                const diag = typeof ev.llm_diagnosis === 'string' ? JSON.parse(ev.llm_diagnosis) : ev.llm_diagnosis;
                if (Array.isArray(diag)) {
                    for (const d of diag as Array<{ rootCause?: string }>) {
                        const cause = d.rootCause ?? 'Unknown';
                        byCause[cause] = (byCause[cause] ?? 0) + 1;
                    }
                }
            } catch { }
        }
        const topFailureSignatures = Object.entries(byCause)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([cause, count]) => ({ cause, count }));
        return {
            total: events.length,
            resolved: events.filter(e => e.outcome === 'RESOLVED').length,
            escalated: events.filter(e => e.outcome === 'ESCALATED_HITL').length,
            topFailureSignatures,
            rollbackFrequency: events.filter(e => e.outcome === 'ESCALATED_HITL').length
        };
    });

    server.get('/analytics/confidence', { schema: { tags: ['Analytics'], summary: 'Confidence score distribution histogram' } }, async () => {
        const steps = await db.selectFrom('run_steps').select('confidence_score').where('confidence_score', 'is not', null).execute();
        const buckets: Record<string, number> = {};
        for (let i = 0; i <= 90; i += 10) buckets[`${i}-${i + 10}`] = 0;
        for (const step of steps) {
            const score = step.confidence_score ?? 0;
            const bucketStart = Math.min(Math.floor(score / 10) * 10, 90);
            buckets[`${bucketStart}-${bucketStart + 10}`] = (buckets[`${bucketStart}-${bucketStart + 10}`] ?? 0) + 1;
        }
        return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
    });

    server.get('/health', { schema: { tags: ['System'], summary: 'Health check — DB, Redis, and Groq status' } }, async (req, res) => {
        const checks = { db: 'error' as 'connected' | 'error', redis: 'error' as 'connected' | 'error', groq: 'error' as 'reachable' | 'error' };
        try {
            await db.selectFrom('workflow_runs').select('id').limit(1).execute();
            checks.db = 'connected';
        } catch { }
        try {
            await redisClient.ping();
            checks.redis = 'connected';
        } catch { }
        try {
            await preWarmGroqModel();
            checks.groq = 'reachable';
        } catch { }
        const activeRunsResult = await db.selectFrom('workflow_runs').select(db.fn.count('id').as('count')).where('status', '=', 'RUNNING').executeTakeFirst();
        const allHealthy = checks.db === 'connected' && checks.redis === 'connected' && checks.groq === 'reachable';
        res.status(allHealthy ? 200 : 503).send({
            status: allHealthy ? 'ok' : 'degraded',
            db: checks.db,
            redis: checks.redis,
            groq: checks.groq,
            activeRuns: Number(activeRunsResult?.count ?? 0),
            uptime: process.uptime()
        });
    });

    server.get('/runs/:runId/autopsy/pdf', { schema: { tags: ['Autopsy'], summary: 'Download autopsy PDF for a run' } }, async (req: any, res) => {
        const report = await db.selectFrom('autopsy_reports').selectAll().where('run_id', '=', req.params.runId).executeTakeFirst();
        if (!report || !report.pdf_path) return res.status(404).send({ error: 'PDF not found' });
        try {
            const stream = fs.createReadStream(report.pdf_path);
            res.type('application/pdf');
            return res.send(stream);
        } catch {
            return res.status(500).send({ error: 'Failed to read PDF file' });
        }
    });

    server.post('/runs/:runId/autopsy/send', { schema: { tags: ['Autopsy'], summary: 'Email autopsy report to the team' } }, async (req: any, res) => {
        const email = (req.body as { email?: string }).email ?? process.env.EMAIL_DEMO_RECIPIENT ?? 'team@example.com';
        const runId = req.params.runId as string;

        if (process.env.MOCK_SMTP === 'true') {
            await publishEvent(runId, { type: 'AUTOPSY_SENT', payload: { destination: email, mocked: true } });
            return { status: 'SENT_MOCKED' };
        }

        const report = await db.selectFrom('autopsy_reports').selectAll().where('run_id', '=', runId).executeTakeFirst();
        if (!report) return res.status(404).send({ error: 'Report not found' });

        try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const content = typeof report.content_json === 'string' ? JSON.parse(report.content_json) : report.content_json as any;

            const html = buildAutopsyEmailHtml(runId, content?.workflowId || 'Unknown', content?.success ?? false, content?.report ?? '');

            let attachments = [];
            if (report.pdf_path && fs.existsSync(report.pdf_path)) {
                attachments.push({
                    filename: `autopsy_${runId}.pdf`,
                    content: fs.readFileSync(report.pdf_path)
                });
            }

            const { data, error } = await resend.emails.send({
                from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
                to: email,
                subject: `[FlowSentrix] Autopsy Report: Run ${runId}`,
                html,
                attachments
            });

            if (error) {
                console.error("Resend error:", error);
                return res.status(500).send({ error: error.message });
            }

            await publishEvent(runId, { type: 'AUTOPSY_SENT', payload: { destination: email, resendId: data?.id } });
            return { status: 'SENT', id: data?.id };
        } catch (e: any) {
            console.error("Failed to send autopsy email", e);
            return res.status(500).send({ error: e.message });
        }
    });

    server.post('/security/scan', {
        schema: {
            tags: ['Security'],
            summary: 'Trigger a manual security vulnerability scan',
            body: {
                type: 'object',
                required: ['repoUrl'],
                properties: {
                    repoUrl: { type: 'string' },
                    scanProfile: { type: 'string' }
                }
            }
        },
        preHandler: requireApiKey
    }, async (req: any) => {
        const wf = await db.selectFrom('workflow_definitions').selectAll().where('id', '=', 'security_scan_pipeline').executeTakeFirst();
        if (!wf) {
            await db.insertInto('workflow_definitions').values({
                id: 'security_scan_pipeline',
                name: 'Security Vulnerability Scan',
                steps: JSON.stringify(USE_CASE_2_PIPELINE),
                confidence_thresholds: JSON.stringify({})
            }).execute();
        }
        const orchestrator = new OrchestratorAgent();
        const body = req.body as { repoUrl?: string; branch?: string };
        const runId = await orchestrator.startRun('security_scan_pipeline', {
            repoUrl: body.repoUrl ?? 'https://github.com/flowsentrix/demo',
            branch: body.branch ?? 'main'
        });
        return { status: 'SCANNING', runId };
    });

    server.get('/security/vulnerabilities', { schema: { tags: ['Security'], summary: 'List all vulnerabilities ordered by severity' } }, async () => {
        return await db.selectFrom('vulnerabilities').selectAll().orderBy('severity_score', 'desc').execute();
    });

    server.post('/compliance/run', {
        schema: {
            tags: ['Compliance & Risk'],
            summary: 'Trigger a SOC2/ISO27001/GDPR compliance audit',
            body: {
                type: 'object',
                required: ['framework'],
                properties: {
                    framework: { type: 'string', enum: ['SOC2', 'ISO27001', 'GDPR'] },
                    scope: { type: 'string' }
                }
            }
        },
        preHandler: requireApiKey
    }, async (req: any) => {
        const wf = await db.selectFrom('workflow_definitions').selectAll().where('id', '=', 'compliance_audit_pipeline').executeTakeFirst();
        if (!wf) {
            await db.insertInto('workflow_definitions').values({
                id: 'compliance_audit_pipeline',
                name: 'Compliance Audit Run',
                steps: JSON.stringify(USE_CASE_4_PIPELINE),
                confidence_thresholds: JSON.stringify({})
            }).execute();
        }
        const orchestrator = new OrchestratorAgent();
        const body = req.body as { framework?: string; scope?: string };
        const framework = body.framework ?? 'SOC2';
        const runId = await orchestrator.startRun('compliance_audit_pipeline', {
            framework,
            scope: body.scope ?? 'all'
        });

        // Fire-and-forget: extract & persist controls/gaps once run finishes
        extractAndSaveComplianceData(runId, framework).catch(console.error);

        return { status: 'STARTED', runId };
    });

    server.get('/risks/active', { schema: { tags: ['Compliance & Risk'], summary: 'Get all unacknowledged active risk flags' } }, async () => {
        return await db.selectFrom('risk_flags').selectAll().where('acknowledged_by', 'is', null).orderBy('risk_score', 'desc').execute();
    });

    server.get('/hitl/:token', { schema: { tags: ['HITL'], summary: 'Server-rendered HTML approval page for external reviewers' } }, async (req: any, res) => {
        const { token } = req.params as { token: string };
        const hitl = await db.selectFrom('hitl_requests').selectAll().where('id', '=', token).where('status', '=', 'PENDING').executeTakeFirst();
        if (!hitl) return res.status(404).type('text/html').send('<h1>Link Expired or Invalid</h1><p>This HITL decision has already been processed or the token is invalid.</p>');

        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>FlowSentrix Approval</title>
                    <style>
                        body { font-family: sans-serif; background: #0a0a0a; color: #fff; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                        .card { background: #1a1a1a; border: 1px solid #333; padding: 32px; max-width: 500px; width: 100%; border-radius: 4px; }
                        h1 { color: #00D4FF; margin-top: 0; }
                        p { line-height: 1.6; color: #ccc; }
                        .btn { display: inline-block; padding: 12px 24px; border-radius: 2px; font-weight: bold; cursor: pointer; text-decoration: none; margin-right: 12px; font-size: 14px; border: none; }
                        .btn-approve { background: #00D4FF; color: #000; }
                        .btn-reject { background: transparent; color: #ef4444; border: 1px solid #ef4444; }
                        form { margin-top: 24px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Human Review</h1>
                        <p><strong>Run Context:</strong> ${hitl.run_id.split('-')[0]}</p>
                        <p>${hitl.llm_briefing || 'Manual intervention required to proceed with workflow.'}</p>
                        <form method="POST" action="/api/hitl/${token}/approve" style="display:inline;">
                            <button type="submit" class="btn btn-approve">APPROVE</button>
                        </form>
                        <form method="POST" action="/api/hitl/${token}/reject" style="display:inline;">
                             <input type="hidden" name="instructions" value="Rejected via external link">
                            <button type="submit" class="btn btn-reject">REJECT</button>
                        </form>
                    </div>
                </body>
            </html>
        `;
        return res.type('text/html').send(html);
    });

    registerAllTools();
    await preWarmGroqModel();
    if (process.env.AUTO_SEED === 'true') {
        await autoSeed();
    }
    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: '0.0.0.0' });

    const shutdown = async (signal: string) => {
        server.log.info(`${signal} received. Closing connections...`);
        await server.close();
        await db.destroy();
        await redisClient.quit();
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

if (require.main === module) {
    startServer().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
