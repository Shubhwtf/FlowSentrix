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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = slackRoutes;
const client_1 = require("../db/client");
const crypto = __importStar(require("crypto"));
async function slackRoutes(fastify) {
    fastify.post('/slack/actions', async (request, reply) => {
        // Since we are mocking in dev unless SLACK_SIGNING_SECRET is provided,
        // we conditionally verify if the secret exists.
        const secret = process.env.SLACK_SIGNING_SECRET;
        if (secret) {
            const signature = request.headers['x-slack-signature'];
            const timestamp = request.headers['x-slack-request-timestamp'];
            // Fastify body might already be parsed, Slack needs the raw raw body. 
            // We use JSON.stringify as fallback if rawBody isn't available, but Fastify usually requires a plugin for true rawBody.
            // For this demo, we assume the stringified parsed body matches closely enough or rawBody exists.
            const bodyString = request.rawBody || JSON.stringify(request.body);
            const sigBasestring = `v0:${timestamp}:${bodyString}`;
            const mySignature = 'v0=' + crypto.createHmac('sha256', secret).update(sigBasestring).digest('hex');
            if (crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature))) {
                // Signature is valid
            }
            else {
                console.error("Slack signature verification failed: mismatch");
                return reply.status(401).send({ error: 'Unauthorized' });
            }
        }
        const body = request.body;
        if (!body || !body.payload)
            return reply.send({ ok: true });
        const payload = JSON.parse(body.payload);
        if (payload.type !== 'block_actions' || !payload.actions?.length) {
            return reply.send({ ok: true });
        }
        const action = payload.actions[0];
        // HITL Review: Slack will automatically handle the URL redirect if it's a URL button.
        // If it's just a value button, handle it here.
        if (action.action_id === 'risk_acknowledge') {
            const riskFlagId = action.value;
            await client_1.db.updateTable('risk_flags')
                .set({
                acknowledged_by: payload.user.id || 'slack_user',
                acknowledged_at: new Date()
            })
                .where('id', '=', riskFlagId)
                .execute();
            await client_1.db.insertInto('audit_log').values({
                entity_type: 'risk_flag',
                entity_id: riskFlagId,
                event_type: 'RISK_ACKNOWLEDGED',
                actor: payload.user.id || 'slack_user',
                payload: JSON.stringify({ slack_user: payload.user.username })
            }).execute();
            // Optionally call client.chat.update to alter the Slack message here.
            // Return ok to acknowledge receipt
            return reply.send({ ok: true });
        }
        return reply.send({ ok: true });
    });
}
