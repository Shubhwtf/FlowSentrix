export interface RunState {
    id: string;
    workflowId: string;
    status: string;
    steps: Record<number, StepState>;
    healingEvents: HealingEvent[];
    lastUpdated: number;
}

export interface StepState {
    index: number;
    agentType: string;
    status: string;
    confidenceScore?: number;
    output?: any;
    error?: string;
}

export interface HealingEvent {
    stepIndex: number;
    agentType: string;
    attempts: number;
    status: string;
    diagnosis?: any;
}
