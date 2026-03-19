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
exports.preWarmGroqModel = exports.executeGroqWithRetry = exports.RateLimitExceededError = void 0;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const dotenv = __importStar(require("dotenv"));
const pino_1 = __importDefault(require("pino"));
const node_fetch_1 = __importDefault(require("node-fetch"));
dotenv.config();
const logger = (0, pino_1.default)();
const KEYMGR_BASE_URL = process.env.KEYMGR_BASE_URL || 'https://objobj-keymgr.objectobjectt.dev';
const KEYMGR_JWT = process.env.KEYMGR_JWT;
const KEYMGR_PROVIDER = process.env.KEYMGR_PROVIDER || 'GROQ';
const getGroqApiKey = async () => {
    if (!KEYMGR_JWT) {
        throw new Error('Key manager JWT (KEYMGR_JWT) not configured');
    }
    try {
        const res = await (0, node_fetch_1.default)(`${KEYMGR_BASE_URL}/${encodeURIComponent(KEYMGR_PROVIDER)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${KEYMGR_JWT}`
            }
        });
        if (!res.ok) {
            logger.error({ status: res.status }, 'KeyManagerRequestFailed');
            throw new Error(`Key manager request failed with status ${res.status}`);
        }
        const data = await res.json();
        // The key manager can return either:
        // 1) A single key object: { id, key, isRateLimited, rateLimitTTL }
        // 2) A list: { provider, keys: [ { id, key, ... } ] }
        if (typeof data?.key === 'string') {
            logger.info({ provider: KEYMGR_PROVIDER, keyId: data.id }, 'KeyManagerSelectedKeySingle');
            return data.key;
        }
        const keys = Array.isArray(data?.keys) ? data.keys : [];
        const available = keys.filter(k => !k.isRateLimited);
        const pool = available.length > 0 ? available : keys;
        if (pool.length === 0) {
            logger.error({ provider: KEYMGR_PROVIDER }, 'KeyManagerNoKeysAvailable');
            throw new Error('Key manager returned no keys');
        }
        const idx = Math.floor(Math.random() * pool.length);
        const chosen = pool[idx];
        logger.info({ provider: KEYMGR_PROVIDER, keyId: chosen.id }, 'KeyManagerSelectedKeyFromList');
        return chosen.key;
    }
    catch (error) {
        logger.error({ error: error?.message }, 'KeyManagerError');
        throw new Error('Key manager unavailable or returned invalid data');
    }
};
class RateLimitExceededError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RateLimitExceededError';
    }
}
exports.RateLimitExceededError = RateLimitExceededError;
let groqCallsTotal = 0;
let groqCallTimestampsMs = [];
const getCallsLastMinute = () => {
    const now = Date.now();
    groqCallTimestampsMs = groqCallTimestampsMs.filter((t) => now - t < 60_000);
    return groqCallTimestampsMs.length;
};
const executeGroqWithRetry = async (messages, tools = [], taskType = 'default', retries = 3, backoffMs = 500) => {
    const defaultModel = process.env.GROQ_MODEL_DEFAULT || 'llama-3.1-8b-instant';
    const heavyModel = process.env.GROQ_MODEL_HEAVY || 'llama-3.3-70b-versatile';
    const maxTokens = Number(process.env.GROQ_MAX_TOKENS || '512');
    const maxRetries = Math.max(0, Math.min(3, Number(process.env.GROQ_RETRIES || String(retries))));
    let model = defaultModel;
    if (['autopsy', 'document_generation', 'code_analysis'].includes(taskType)) {
        model = heavyModel;
    }
    console.log(`[GroqClient] [${taskType}] Requesting ${model} with ${tools.length} tools`);
    const responseFormat = taskType === 'confidence_scoring' ? { type: 'json_object' } : undefined;
    const timeoutMs = Math.max(5000, Number(process.env.GROQ_REQUEST_TIMEOUT_MS || '60000'));
    for (let i = 0; i < maxRetries; i++) {
        try {
            const callsLastMinute = getCallsLastMinute();
            if (callsLastMinute >= 20) {
                logger.error({ groqCallsTotal, groqCallsLastMinute: callsLastMinute }, 'GroqRateLimitExceeded');
                throw new RateLimitExceededError('GroqRateLimitExceeded');
            }
            const apiKey = await getGroqApiKey();
            const client = new groq_sdk_1.default({ apiKey });
            const completion = await Promise.race([
                client.chat.completions.create({
                    messages,
                    model,
                    temperature: 0.1,
                    max_tokens: maxTokens,
                    tools: tools && tools.length > 0 ? tools : undefined,
                    tool_choice: tools && tools.length > 0 ? 'auto' : 'none',
                    response_format: responseFormat,
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('GroqTimeout')), timeoutMs))
            ]);
            groqCallsTotal += 1;
            groqCallTimestampsMs.push(Date.now());
            if (groqCallsTotal % 10 === 0) {
                logger.info({ groqCallsTotal, groqCallsLastMinute: getCallsLastMinute() }, 'GroqCallVolume');
            }
            return completion.choices[0].message;
        }
        catch (error) {
            console.error(`[GroqClient] Attempt ${i + 1} failed:`, error.message);
            if (i === maxRetries - 1)
                throw error;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
};
exports.executeGroqWithRetry = executeGroqWithRetry;
const preWarmGroqModel = async () => {
    try {
        const startTime = Date.now();
        const apiKey = await getGroqApiKey();
        const client = new groq_sdk_1.default({ apiKey });
        await client.chat.completions.create({
            messages: [{ role: 'user', content: 'Warmup.' }],
            model: 'llama-3.1-8b-instant',
            max_tokens: 5,
        });
        logger.info({ elapsedMs: Date.now() - startTime }, 'GroqClientPreWarmSuccess');
    }
    catch (error) {
        logger.error({ error }, 'GroqClientPreWarmFailed');
    }
};
exports.preWarmGroqModel = preWarmGroqModel;
