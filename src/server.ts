import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { db } from './db/client';
import { OrchestratorAgent } from './agents/OrchestratorAgent';
import { preWarmGroqModel } from './agents/base/GroqClient';
import { registerAllTools } from './agents/tools';
import { redisSub } from './events/bus';
import { USE_CASE_1_PIPELINE, USE_CASE_2_PIPELINE, USE_CASE_3_PIPELINE, USE_CASE_4_PIPELINE, USE_CASE_5_PIPELINE } from './agents/workers/templates';
import { executeRollback } from './events/rollback';

export const server = Fastify({ logger: true });

export const startServer = async () => {
    await server.register(swagger, {
        swagger: {
            info: { title: 'FlowSentrix API', version: '1.0.0' },
        }
    });

    await server.register(swaggerUi, {
        routePrefix: '/docs',
    });

    server.get('/workflows', async (req, res) => {
        return await db.selectFrom('workflow_definitions').selectAll().execute();
    });

    server.post('/workflows', async (req: any, res) => {
        const data = req.body;
        return await db.insertInto('workflow_definitions').values({
            name: data.name,
            steps: JSON.stringify(data.steps),
            confidence_thresholds: JSON.stringify(data.confidence_thresholds || {}),
        }).returningAll().executeTakeFirstOrThrow();
    });

    server.post('/seed', async (req, res) => {
        await db.insertInto('workflow_definitions').values({
            name: 'Employee Onboarding Demo',
            steps: JSON.stringify(USE_CASE_1_PIPELINE)
        }).execute();
        return { success: true };
    });

    server.get('/workflows/:id', async (req: any, res) => {
        const record = await db.selectFrom('workflow_definitions').selectAll().where('id', '=', req.params.id).executeTakeFirst();
        if (!record) return res.status(404).send({ error: 'Not found' });
        return record;
    });

    server.put('/workflows/:id', async (req: any, res) => {
        const data = req.body;
        return await db.updateTable('workflow_definitions').set({
            name: data.name,
            steps: JSON.stringify(data.steps)
        }).where('id', '=', req.params.id).returningAll().executeTakeFirstOrThrow();
    });

    server.delete('/workflows/:id', async (req: any, res) => {
        await db.deleteFrom('workflow_definitions').where('id', '=', req.params.id).execute();
        return { success: true };
    });

    server.post('/workflows/:id/run', async (req: any, res) => {
        const orchestrator = new OrchestratorAgent();
        orchestrator.startRun(req.params.id, req.body).catch(e => {
            server.log.error(e);
        });
        return { status: 'STARTED' };
    });

    server.get('/runs', async (req, res) => {
        return await db.selectFrom('workflow_runs').selectAll().execute();
    });

    server.get('/runs/:runId', async (req: any, res) => {
        const record = await db.selectFrom('workflow_runs').selectAll().where('id', '=', req.params.runId).executeTakeFirst();
        if (!record) return res.status(404).send({ error: 'Not found' });
        return record;
    });

    server.get('/runs/:runId/timeline', async (req: any, res) => {
        return await db.selectFrom('healing_events').selectAll().where('run_id', '=', req.params.runId).execute();
    });

    server.post('/runs/:runId/cancel', async (req: any, res) => {
        return { status: 'CANCELLED' };
    });

    server.post('/runs/:runId/retry', async (req: any, res) => {
        const orchestrator = new OrchestratorAgent();
        orchestrator.resumeRun(req.params.runId).catch(console.error);
        return { status: 'RETRIED' };
    });

    server.get('/runs/:runId/snapshots', async (req: any, res) => {
        return await db.selectFrom('snapshots').selectAll().where('run_id', '=', req.params.runId).execute();
    });

    server.get('/runs/:runId/snapshots/:snapId', async (req: any, res) => {
        return await db.selectFrom('snapshots').selectAll().where('id', '=', req.params.snapId).executeTakeFirst();
    });

    server.post('/runs/:runId/rollback/:snapId', async (req: any, res) => {
        const snapshot = await db.selectFrom('snapshots').selectAll().where('id', '=', req.params.snapId).executeTakeFirst();
        if (!snapshot) return res.status(404).send({ error: 'Snapshot not found' });
        await executeRollback(req.params.runId, snapshot.step_index);
        return { status: 'ROLLED_BACK', targetStepIndex: snapshot.step_index };
    });

    server.get('/runs/:runId/healing-events', async (req: any, res) => {
        return await db.selectFrom('healing_events').selectAll().where('run_id', '=', req.params.runId).execute();
    });

    server.get('/runs/:runId/autopsy', async (req: any, res) => {
        return await db.selectFrom('autopsy_reports').selectAll().where('run_id', '=', req.params.runId).executeTakeFirst();
    });

    server.get('/hitl/:token', async (req: any, res) => {
        res.type('text/html');
        return `<html><body><h1>HITL Approval</h1><form method="POST" action="/hitl/${req.params.token}/approve"><button type="submit">Approve</button></form></body></html>`;
    });

    server.post('/hitl/:hitlId/approve', async (req: any, res) => {
        return { status: 'APPROVED' };
    });

    server.post('/hitl/:hitlId/reject', async (req: any, res) => {
        return { status: 'REJECTED' };
    });

    server.post('/hitl/:hitlId/modify', async (req: any, res) => {
        return { status: 'MODIFIED' };
    });

    server.get('/stream/runs/:runId', async (req: any, res) => {
        const runId = req.params.runId;
        res.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        const sub = redisSub.duplicate();
        await sub.subscribe(`run:events:${runId}`);
        sub.on('message', (channel, message) => {
            if (channel === `run:events:${runId}`) {
                res.raw.write(`data: ${message}\n\n`);
            }
        });
        req.raw.on('close', () => {
            sub.unsubscribe();
            sub.quit();
        });
    });

    server.post('/integrations', async () => ({ status: 'CREATED' }));
    server.get('/integrations', async () => ([]));
    server.get('/integrations/:id/test', async () => ({ status: 'OK' }));
    server.delete('/integrations/:id', async () => ({ success: true }));

    server.post('/security/scan', async () => ({ status: 'SCANNING' }));
    server.get('/security/vulnerabilities', async () => ([]));
    server.post('/compliance/run', async () => ({ status: 'RUNNING' }));
    server.get('/risks/active', async () => ([]));

    registerAllTools();
    await preWarmGroqModel();
    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: '0.0.0.0' });
};

if (require.main === module) {
    startServer().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
