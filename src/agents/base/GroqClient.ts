import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

const logger = pino();
const apiKey = process.env.GROQ_API_KEY;
export const groq = new Groq({ apiKey });

export const executeGroqWithRetry = async (
    messages: any[],
    tools?: any[],
    retries = 3,
    backoffMs = 500
): Promise<any> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await groq.chat.completions.create({
                messages,
                model: 'llama-3.1-8b-instant',
                temperature: 0.1,
                max_tokens: 1024,
                tools,
                tool_choice: tools ? 'auto' : 'none',
            });
            return response.choices[0].message;
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            logger.warn({ attempt, error }, 'GroqClientRetry');
            await new Promise(res => setTimeout(res, backoffMs * attempt));
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
