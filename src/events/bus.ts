import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisPub = new Redis(redisUrl);
export const redisSub = new Redis(redisUrl);
export const redisClient = new Redis(redisUrl);

export interface WorkflowEvent {
    runId: string;
    stepIndex?: number;
    agentType?: string;
    timestamp: number;
    type: string;
    payload?: any;
}

export const publishEvent = async (runId: string, event: Omit<WorkflowEvent, 'runId' | 'timestamp'>) => {
    const fullEvent: WorkflowEvent = {
        ...event,
        runId,
        timestamp: Date.now(),
    };
    await redisPub.publish(`run:events:${runId}`, JSON.stringify(fullEvent));
};

export const subscribeToRun = (runId: string, callback: (event: WorkflowEvent) => void) => {
    redisSub.subscribe(`run:events:${runId}`);
    redisSub.on('message', (channel, message) => {
        if (channel === `run:events:${runId}`) {
            callback(JSON.parse(message));
        }
    });
};
