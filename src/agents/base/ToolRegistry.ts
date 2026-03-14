import { z } from 'zod';
import { redisClient } from '../../events/bus';
import { randomBytes } from 'crypto';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type ToolImplementation<T> = (args: T, context?: { runId: string, stepIndex: number }) => Promise<any>;

export interface ToolDefinition<T> {
    name: string;
    description: string;
    schema: z.ZodSchema<T>;
    execute: ToolImplementation<T>;
}

export const tools = new Map<string, ToolDefinition<any>>();

export const registerTool = <T>(def: ToolDefinition<T>) => {
    tools.set(def.name, def);
};

export const executeTool = async (name: string, argsRaw: string, context?: { runId: string, stepIndex: number }) => {
    const tool = tools.get(name);
    if (!tool) throw new Error(`ToolNotFound:${name}`);
    const args = tool.schema.parse(JSON.parse(argsRaw));
    return await tool.execute(args, context);
};

export const getGroqTools = () => {
    return Array.from(tools.values()).map(t => {
        return {
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: zodToJsonSchema(t.schema as any),
            }
        };
    });
};

registerTool({
    name: 'generate_hitl_token',
    description: 'Generate single-use token for HITL approval',
    schema: z.object({ hitlId: z.string() }),
    execute: async ({ hitlId }) => {
        const token = randomBytes(32).toString('hex');
        await redisClient.setex(`hitl:tokens:${token}`, 86400, hitlId);
        return { token, hitlUrl: `http://localhost:3000/hitl/${token}` };
    }
});
