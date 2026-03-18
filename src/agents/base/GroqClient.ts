import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

const logger = pino();
const apiKey = process.env.GROQ_API_KEY;
export const groq = new Groq({ apiKey });

export class RateLimitExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RateLimitExceededError';
    }
}

let groqCallsTotal = 0;
let groqCallTimestampsMs: number[] = [];

const getCallsLastMinute = () => {
    const now = Date.now();
    groqCallTimestampsMs = groqCallTimestampsMs.filter((t) => now - t < 60_000);
    return groqCallTimestampsMs.length;
};

export const executeGroqWithRetry = async (
    messages: any[],
    tools: any[] = [],
    taskType: string = 'default',
    retries = 3,
    backoffMs = 500
): Promise<any> => {
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

            const completion = await Promise.race([
                groq.chat.completions.create({
                    messages,
                    model,
                    temperature: 0.1,
                    max_tokens: maxTokens,
                    tools: tools && tools.length > 0 ? tools : undefined,
                    tool_choice: tools && tools.length > 0 ? 'auto' : 'none',
                    response_format: responseFormat as any,
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('GroqTimeout')), timeoutMs))
            ]) as any;
            groqCallsTotal += 1;
            groqCallTimestampsMs.push(Date.now());
            if (groqCallsTotal % 10 === 0) {
                logger.info({ groqCallsTotal, groqCallsLastMinute: getCallsLastMinute() }, 'GroqCallVolume');
            }
            return completion.choices[0].message;
        } catch (error: any) {
            console.error(`[GroqClient] Attempt ${i + 1} failed:`, error.message);
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
};

export const preWarmGroqModel = async () => {
    try {
        const startTime = Date.now();
        await groq.chat.completions.create({
            messages: [{ role: 'user', content: 'Warmup.' }],
            model: 'llama-3.1-8b-instant',
            max_tokens: 5,
        });
        logger.info({ elapsedMs: Date.now() - startTime }, 'GroqClientPreWarmSuccess');
    } catch (error) {
        logger.error({ error }, 'GroqClientPreWarmFailed');
    }
};
