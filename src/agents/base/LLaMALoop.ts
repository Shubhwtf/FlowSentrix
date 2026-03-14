import { executeGroqWithRetry } from './GroqClient';
import { executeTool, getGroqTools } from './ToolRegistry';

export const runLLaMALoop = async (initialMessages: any[], toolsAllowed: string[] = [], context?: { runId: string, stepIndex: number }): Promise<any> => {
    const messages = [...initialMessages];
    const maxIterations = 10;

    const allTools = getGroqTools();
    const allowedGroqTools = allTools.filter(t => toolsAllowed.includes(t.function.name));

    for (let i = 0; i < maxIterations; i++) {
        const message = await executeGroqWithRetry(messages, allowedGroqTools.length > 0 ? allowedGroqTools : undefined);
        messages.push(message);

        if (message.tool_calls && message.tool_calls.length > 0) {
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
