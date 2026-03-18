import { executeGroqWithRetry } from './GroqClient';
import { executeTool, getGroqTools } from './ToolRegistry';
import pino from 'pino';

const logger = pino();
const maxIterations = 5;

export const runLLaMALoop = async (
    initialMessages: any[],
    toolsAllowed: string[] = [],
    context?: { runId: string, stepIndex: number },
    taskType: string = 'default'
): Promise<any> => {
    let messages = [...initialMessages];
    const maxContextTokens = Math.max(1200, Number(process.env.GROQ_MAX_CONTEXT_TOKENS || '3500'));
    const toolResultCharLimit = Math.max(500, Number(process.env.GROQ_TOOL_RESULT_CHAR_LIMIT || '1200'));
    const minKeep = Math.max(4, Number(process.env.GROQ_MIN_KEEP_MESSAGES || '6'));
    let iterationCounter = 0;
    let lastAssistantContent = '';
    let lastToolResultContent = '';

    const allTools = getGroqTools();
    const allowedGroqTools = allTools.filter(t => toolsAllowed.includes(t.function.name));

    for (let i = 0; i < maxIterations; i++) {
        iterationCounter += 1;
        let totalChars = messages.reduce((acc, m) => acc + (m.content ? String(m.content).length : 0), 0);
        let estimatedTokens = totalChars / 4;

        if (estimatedTokens > maxContextTokens && messages.length > minKeep) {
            const keepHead = messages.slice(0, 1);
            const keepTail = messages.slice(-Math.min(4, messages.length - 1));
            const middle = messages.slice(1, -keepTail.length);
            while (estimatedTokens > maxContextTokens && middle.length > 0) {
                const removed = middle.shift();
                totalChars -= removed?.content ? String(removed.content).length : 0;
                estimatedTokens = totalChars / 4;
            }
            messages = [...keepHead, ...middle, ...keepTail];
        }

        const currentAllowedTools = toolsAllowed.length > 0 ? allowedGroqTools : [];
        const hasTools = currentAllowedTools.length > 0;

        const effectiveMessages = [
            ...messages,
            {
                role: 'system',
                content: toolsAllowed.length > 0
                    ? `AVAILABLE TOOLS: ${toolsAllowed.join(', ')}. You MUST NOT attempt to use any tools outside of this list.`
                    : `NO TOOLS AVAILABLE. You MUST respond with a direct text answer.`
            }
        ];

        const message = await executeGroqWithRetry(effectiveMessages, hasTools ? currentAllowedTools : [], taskType);
        messages.push(message);
        lastAssistantContent = typeof message?.content === 'string' ? message.content : lastAssistantContent;

        if (message.tool_calls && message.tool_calls.length > 0) {
            console.log(`[LLaMALoop] [${context?.runId.split('-')[0]}] Iteration ${i + 1}: Calling ${message.tool_calls.length} tools...`);
            for (const toolCall of message.tool_calls) {
                try {
                    const result = await executeTool(toolCall.function.name, toolCall.function.arguments, context);
                    const serialized = JSON.stringify(result);
                    const clipped = serialized.length > toolResultCharLimit
                        ? `${serialized.slice(0, toolResultCharLimit)}`
                        : serialized;
                    lastToolResultContent = clipped || lastToolResultContent;
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: toolCall.function.name,
                        content: clipped,
                    });
                } catch (error: any) {
                    const clippedErr = JSON.stringify({ error: error.message });
                    lastToolResultContent = clippedErr || lastToolResultContent;
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: toolCall.function.name,
                        content: clippedErr,
                    });
                }
            }
        } else {
            return { finalAnswer: message.content, conversationHistory: messages };
        }
    }
    logger.warn({ runId: context?.runId, stepIndex: context?.stepIndex, taskType, iterationCounter, maxIterations }, 'LLaMALoopIterationCapHit');
    return { finalAnswer: lastAssistantContent || lastToolResultContent, conversationHistory: messages };
};
