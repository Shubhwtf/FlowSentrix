import { redisSub, publishEvent, WorkflowEvent } from '../events/bus';

export class MonitorAgent {
    constructor(private readonly confidenceThreshold: number = 75) { }

    public listen(runId: string) {
        redisSub.subscribe(`run:events:${runId}`);
        redisSub.on('message', async (channel, message) => {
            if (channel !== `run:events:${runId}`) return;
            const event: WorkflowEvent = JSON.parse(message);

            if (event.type === 'STEP_OUTPUT' && event.payload?.score !== undefined) {
                if (event.payload.score < this.confidenceThreshold) {
                    await publishEvent(runId, {
                        type: 'CONFIDENCE_LOW',
                        stepIndex: event.stepIndex,
                        agentType: event.agentType,
                        payload: { score: event.payload.score }
                    });
                    await publishEvent(runId, {
                        type: 'HEAL_REQUIRED',
                        stepIndex: event.stepIndex,
                        agentType: event.agentType,
                        payload: event.payload
                    });
                }
            } else if (event.type === 'STEP_FAILED') {
                await publishEvent(runId, {
                    type: 'HEAL_REQUIRED',
                    stepIndex: event.stepIndex,
                    agentType: event.agentType,
                    payload: event.payload
                });
            }
        });
    }
}
