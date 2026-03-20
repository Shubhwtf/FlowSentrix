import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

const logger = pino();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL_DEFAULT = process.env.GROQ_MODEL_DEFAULT || 'llama-3.1-8b-instant';
const GROQ_MODEL_HEAVY = process.env.GROQ_MODEL_HEAVY || 'llama-3.3-70b-versatile';

const GROQ_MAX_TOKENS = Number(process.env.GROQ_MAX_TOKENS || '512');
const GROQ_MAX_CONTEXT_TOKENS = Number(process.env.GROQ_MAX_CONTEXT_TOKENS || '3500');
const GROQ_TOOL_RESULT_CHAR_LIMIT = Number(process.env.GROQ_TOOL_RESULT_CHAR_LIMIT || '1200');
const GROQ_REQUEST_TIMEOUT_MS = Number(process.env.GROQ_REQUEST_TIMEOUT_MS || '60000');
const GROQ_LOCAL_RATE_LIMIT_CALLS = Number(process.env.GROQ_LOCAL_RATE_LIMIT_CALLS || '20');
const GROQ_LOCAL_RATE_LIMIT_WINDOW_MS = Number(process.env.GROQ_LOCAL_RATE_LIMIT_WINDOW_MS || String(60_000));
const GROQ_CACHE_MAX_ITEMS = Math.max(200, Number(process.env.GROQ_CACHE_MAX_ITEMS || '2000'));
const GROQ_CACHE_TTL_MS = Math.max(60_000, Number(process.env.GROQ_CACHE_TTL_MS || String(6 * 60 * 60 * 1000)));
const GROQ_MIN_CACHE_SIMILARITY = Math.max(
    0,
    Math.min(0.95, Number(process.env.GROQ_MIN_CACHE_SIMILARITY || '0.55'))
);

const getGroqApiKey = (): string => {
    if (GROQ_API_KEY.length > 0) return GROQ_API_KEY;
    throw new Error('GROQ_API_KEY not configured');
};

type GroqChatMessage = {
    role?: string;
    content?: string | null;
    tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
    }>;
};

type CachedCompletionEntry = {
    taskType: string;
    normalizedPrompt: string;
    message: GroqChatMessage;
    createdAtMs: number;
    lastUsedAtMs: number;
    hitCount: number;
};

const completionCache = new Map<string, CachedCompletionEntry>();

const getNowMs = () => Date.now();

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const computeTokenOverlapScore = (left: string, right: string) => {
    const leftTokens = new Set(left.split(' ').filter(Boolean));
    const rightTokens = new Set(right.split(' ').filter(Boolean));
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

    let overlap = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) overlap += 1;
    }
    const denom = Math.max(leftTokens.size, rightTokens.size);
    return denom === 0 ? 0 : overlap / denom;
};

const buildPromptSignature = (messages: Array<{ role?: string; content?: unknown }>) => {
    const parts: string[] = [];
    for (const message of messages) {
        if (typeof message.content === 'string' && message.content.length > 0) {
            parts.push(`${message.role || 'unknown'}:${message.content}`);
        }
    }
    const joined = parts.join(' | ');
    const normalized = normalizeText(joined);
    return normalized.length > 2000 ? normalized.slice(0, 2000) : normalized;
};

const selectCachedMessage = (taskType: string, normalizedPrompt: string) => {
    const nowMs = getNowMs();
    let best: CachedCompletionEntry | null = null;
    let bestScore = 0;

    for (const entry of completionCache.values()) {
        if (entry.taskType !== taskType) continue;
        if (nowMs - entry.createdAtMs > GROQ_CACHE_TTL_MS) continue;

        const score = computeTokenOverlapScore(normalizedPrompt, entry.normalizedPrompt);
        if (score > bestScore) {
            best = entry;
            bestScore = score;
        }
    }

    if (!best) return null;
    if (bestScore < GROQ_MIN_CACHE_SIMILARITY) return null;

    best.hitCount += 1;
    best.lastUsedAtMs = nowMs;
    return { best, score: bestScore };
};

const upsertCacheEntry = (cacheKey: string, entry: CachedCompletionEntry) => {
    const nowMs = getNowMs();
    const existing = completionCache.get(cacheKey);

    if (existing) {
        existing.message = entry.message;
        existing.lastUsedAtMs = nowMs;
        existing.hitCount += 1;
        return;
    }

    entry.createdAtMs = nowMs;
    entry.lastUsedAtMs = nowMs;
    entry.hitCount = entry.hitCount || 1;
    completionCache.set(cacheKey, entry);

    if (completionCache.size <= GROQ_CACHE_MAX_ITEMS) return;

    const entries = Array.from(completionCache.entries());
    entries.sort((a, b) => (a[1].lastUsedAtMs || 0) - (b[1].lastUsedAtMs || 0));
    const removeCount = Math.max(1, entries.length - GROQ_CACHE_MAX_ITEMS);
    for (let i = 0; i < removeCount; i += 1) completionCache.delete(entries[i][0]);
};

const isRateLimitLikeErrorMessage = (errorMessage: string) => {
    const lowered = errorMessage.toLowerCase();
    return (
        lowered.includes('429') ||
        lowered.includes('rate limit') ||
        lowered.includes('too many requests') ||
        lowered.includes('ratelimit') ||
        lowered.includes('rate_limited')
    );
};

class RateLimitExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RateLimitExceededError';
    }
}

let localGroqCallTimestampsMs: number[] = [];

const getLocalCallsInWindow = () => {
    const nowMs = getNowMs();
    localGroqCallTimestampsMs = localGroqCallTimestampsMs.filter((t) => nowMs - t < GROQ_LOCAL_RATE_LIMIT_WINDOW_MS);
    return localGroqCallTimestampsMs.length;
};

export const executeGroqWithRetry = async (
    messages: any[],
    tools: any[] = [],
    taskType: string = 'default',
    retries = 3,
    backoffMs = 500
): Promise<GroqChatMessage> => {
    const model = taskType === 'autopsy' || taskType === 'document_generation' || taskType === 'code_analysis'
        ? GROQ_MODEL_HEAVY
        : GROQ_MODEL_DEFAULT;

    const maxRetries = Math.max(0, Math.min(3, Number(process.env.GROQ_RETRIES || String(retries))));
    const timeoutMs = Math.max(5000, GROQ_REQUEST_TIMEOUT_MS);
    const responseFormat: { type: 'json_object' } | undefined =
        taskType === 'confidence_scoring' ? { type: 'json_object' } : undefined;

    const normalizedPrompt = buildPromptSignature(messages || []);
    const hasTools = tools && tools.length > 0;
    const cacheKey = `${taskType}|${hasTools ? 'tools' : 'no_tools'}|${normalizedPrompt}`;

    for (let attemptIndex = 0; attemptIndex < maxRetries; attemptIndex += 1) {
        try {
            const callsInWindow = getLocalCallsInWindow();
            if (callsInWindow >= GROQ_LOCAL_RATE_LIMIT_CALLS) {
                throw new RateLimitExceededError('LocalGroqRateLimitExceeded');
            }

            const client = new Groq({ apiKey: getGroqApiKey() });

            const completionPromise = client.chat.completions.create({
                    messages,
                    model,
                    temperature: 0.1,
                    max_tokens: GROQ_MAX_TOKENS,
                    tools: hasTools ? tools : undefined,
                    tool_choice: hasTools ? 'auto' : 'none',
                    response_format: responseFormat
                });

            type ChatCompletionShape = { choices: Array<{ message: GroqChatMessage }> };
            const completion = await Promise.race([
                completionPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('GroqTimeout')), timeoutMs))
            ]) as ChatCompletionShape;

            localGroqCallTimestampsMs.push(getNowMs());

            const message = completion.choices[0].message;
            const content = typeof message?.content === 'string' ? message.content : '';
            const hasToolCalls = Array.isArray(message?.tool_calls) && message.tool_calls.length > 0;

            if (content.length > 0 && !hasToolCalls) {
                upsertCacheEntry(cacheKey, {
                    taskType,
                    normalizedPrompt,
                    message: { role: message.role, content: message.content, tool_calls: undefined },
                    createdAtMs: getNowMs(),
                    lastUsedAtMs: getNowMs(),
                    hitCount: 1
                });
            }

            return message;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isLastAttempt = attemptIndex === maxRetries - 1;

            if (isRateLimitLikeErrorMessage(errorMessage)) {
                const cachedSelection = selectCachedMessage(taskType, normalizedPrompt);
                if (cachedSelection) {
                    const cachedMessage = cachedSelection.best.message;
                    const cachedContent = typeof cachedMessage.content === 'string' ? cachedMessage.content : '';
                    logger.warn(
                        { taskType, similarity: cachedSelection.score, cachedHitCount: cachedSelection.best.hitCount },
                        'GroqRateLimitFallbackToCachedInference'
                    );
                    return {
                        role: 'assistant',
                        content: `Precomputed result due to API limits. LLM rate limit detected -> routing to cached inference layer.\n\n${cachedContent}`
                    };
                }
            }

            if (isLastAttempt) throw error;
            await new Promise((resolve) => setTimeout(resolve, backoffMs * Math.pow(2, attemptIndex)));
        }
    }

    throw new Error('GroqRetryExhausted');
};

export const preWarmGroqModel = async (): Promise<void> => {
    try {
        const client = new Groq({ apiKey: getGroqApiKey() });
        await client.chat.completions.create({
            messages: [{ role: 'user', content: 'Warmup.' }],
            model: GROQ_MODEL_DEFAULT,
            max_tokens: 5
        });
        logger.info('GroqClientPreWarmSuccess');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'GroqClientPreWarmFailed');
    }
};

