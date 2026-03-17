import { executeGroqWithRetry } from './GroqClient';
import { executeTool, getGroqTools } from './ToolRegistry';

export const runLLaMALoop = async (
    initialMessages: any[],
    toolsAllowed: string[] = [],
    context?: { runId: string, stepIndex: number },
    taskType: string = 'default'
): Promise<any> => {
    let messages = [...initialMessages];
    const maxIterations = 10;

    const allTools = getGroqTools();
    const allowedGroqTools = allTools.filter(t => toolsAllowed.includes(t.function.name));

    for (let i = 0; i < maxIterations; i++) {
        // Token Trimming Logic (Estimate: characters / 4)
        let totalChars = messages.reduce((acc, m) => acc + (m.content ? String(m.content).length : 0), 0);
        let estimatedTokens = totalChars / 4;

        if (estimatedTokens > 6000 && messages.length > 5) {
            const systemPrompt = messages[0];
            const recentMessages = messages.slice(-3);
            const middleMessages = messages.slice(1, -3);

            // Trim oldest tool/assistant/user messages from the middle until we are under 6000 tokens or run out of middle messages
            while (estimatedTokens > 6000 && middleMessages.length > 0) {
                const removedMessage = middleMessages.shift();
                totalChars -= removedMessage?.content ? String(removedMessage.content).length : 0;
                estimatedTokens = totalChars / 4;
            }
            messages = [systemPrompt, ...middleMessages, ...recentMessages];
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

        if (message.tool_calls && message.tool_calls.length > 0) {
            console.log(`[LLaMALoop] [${context?.runId.split('-')[0]}] Iteration ${i + 1}: Calling ${message.tool_calls.length} tools...`);
            for (const toolCall of message.tool_calls) {
                try {
                    const result = await executeTool(toolCall.function.name, toolCall.function.arguments, context);
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: toolCall.function.name,
                        content: JSON.stringify(result),
                    });
                } catch (error: any) {
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: toolCall.function.name,
                        content: JSON.stringify({ error: error.message }),
                    });
                }
            }
        } else {
            return { finalAnswer: message.content, conversationHistory: messages };
        }
    }
    throw new Error('LLaMALoopTimeout');
};
