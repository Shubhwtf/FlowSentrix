import { z } from 'zod';
import { redisClient } from '../../events/bus';
import { randomBytes } from 'crypto';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { db } from '../../db/client';
import { logInverseOperation } from '../../events/transactions';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export type ToolImplementation<T> = (args: T, context?: { runId: string, stepIndex?: number }) => Promise<any>;

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

export const executeTool = async (name: string, argsRaw: string, context?: { runId: string, stepIndex?: number }) => {
    const tool = tools.get(name);
    if (!tool) throw new Error(`ToolNotFound:${name}`);
    const args = tool.schema.parse(JSON.parse(argsRaw));

    // 30s timeout for tool execution
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`ToolTimeout:${name} after 30s`)), 30000);
        tool.execute(args, context)
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeout));
    });
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


