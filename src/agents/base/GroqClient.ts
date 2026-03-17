import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

const logger = pino();
const apiKey = process.env.GROQ_API_KEY;
export const groq = new Groq({ apiKey });

export const executeGroqWithRetry = async (
    messages: any[],
    tools: any[] = [],
    taskType: string = 'default',
    retries = 3,
    backoffMs = 500
): Promise<any> => {
    const defaultModel = process.env.GROQ_MODEL_DEFAULT || 'llama-3.1-8b-instant';
    const heavyModel = process.env.GROQ_MODEL_HEAVY || 'llama-3.3-70b-versatile';
    const maxTokens = Number(process.env.GROQ_MAX_TOKENS || '1024');
    let model = defaultModel;
    if (['autopsy', 'document_generation', 'code_analysis'].includes(taskType)) {
        model = heavyModel;
    }

    console.log(`[GroqClient] [${taskType}] Requesting ${model} with ${tools.length} tools`);

    const responseFormat = taskType === 'confidence_scoring' ? { type: 'json_object' } : undefined;

    for (let i = 0; i < 3; i++) {
        try {
            const completion = await groq.chat.completions.create({
                messages,
                model,
                temperature: 0.1,
                max_tokens: maxTokens,
                tools: tools && tools.length > 0 ? tools : undefined,
                tool_choice: tools && tools.length > 0 ? 'auto' : 'none',
                response_format: responseFormat as any,
            });
            return completion.choices[0].message;
        } catch (error: any) {
            console.error(`[GroqClient] Attempt ${i + 1} failed:`, error.message);
            if (i === 2) throw error;
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
