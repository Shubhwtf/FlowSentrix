"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGroqTools = exports.executeTool = exports.registerTool = exports.tools = void 0;
const zod_to_json_schema_1 = require("zod-to-json-schema");
exports.tools = new Map();
const registerTool = (def) => {
    exports.tools.set(def.name, def);
};
exports.registerTool = registerTool;
const executeTool = async (name, argsRaw, context) => {
    const tool = exports.tools.get(name);
    if (!tool)
        throw new Error(`ToolNotFound:${name}`);
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
exports.executeTool = executeTool;
const getGroqTools = () => {
    return Array.from(exports.tools.values()).map(t => {
        return {
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: (0, zod_to_json_schema_1.zodToJsonSchema)(t.schema),
            }
        };
    });
};
exports.getGroqTools = getGroqTools;
