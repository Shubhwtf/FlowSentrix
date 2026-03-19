export interface WorkflowDefinition {
    id: string;
    name: string;
    steps: any;
    confidence_thresholds: any;
    hitl_contacts: any;
    integration_mappings: any;
    created_at: string;
    updated_at: string;
}

export interface WorkflowRun {
    id: string;
    workflow_id: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REQUIRES_HITL' | 'PAUSED';
    trigger_payload: any;
    started_at: string;
    completed_at: string | null;
    outcome: string | null;
}

export class APIClientError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'APIClientError';
        this.status = status;
    }
}
