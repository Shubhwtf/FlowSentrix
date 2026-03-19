"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToRun = exports.publishEvent = exports.redisClient = exports.redisSub = exports.redisPub = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
exports.redisPub = new ioredis_1.default(redisUrl);
exports.redisSub = new ioredis_1.default(redisUrl);
exports.redisClient = new ioredis_1.default(redisUrl);
const publishEvent = async (runId, event) => {
    const fullEvent = {
        ...event,
        runId,
        timestamp: Date.now(),
    };
    await exports.redisPub.publish(`run:events:${runId}`, JSON.stringify(fullEvent));
};
exports.publishEvent = publishEvent;
const subscribeToRun = (runId, callback) => {
    exports.redisSub.subscribe(`run:events:${runId}`);
    exports.redisSub.on('message', (channel, message) => {
        if (channel === `run:events:${runId}`) {
            callback(JSON.parse(message));
        }
    });
};
exports.subscribeToRun = subscribeToRun;
