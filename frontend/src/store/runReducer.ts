import type { RunState } from './types';

export type RunAction =
    | { type: 'RUN_STARTED'; payload: { workflowId: string } }
    | { type: 'STEP_STARTED'; stepIndex: number; agentType: string }
    | { type: 'STATE_UPDATE'; stepIndex: number; state: string; payload?: any }
    | { type: 'STEP_OUTPUT'; stepIndex: number; payload: { output: any, score: number } }
    | { type: 'HEAL_REQUIRED'; stepIndex: number }
    | { type: 'HEAL_ATTEMPT'; stepIndex: number; payload: { attempt: number } }
    | { type: 'HEAL_SUCCEEDED'; stepIndex: number }
    | { type: 'HEAL_FAILED'; stepIndex: number }
    | { type: 'HITL_TRIGGERED'; stepIndex: number; payload: { hitlUrl: string } }
    | { type: 'ROLLBACK_STARTED'; stepIndex: number }
    ;

export const runReducer = (state: RunState, action: RunAction): RunState => {
    const now = Date.now();

    switch (action.type) {
        case 'RUN_STARTED':
            return { ...state, workflowId: action.payload.workflowId, status: 'RUNNING', lastUpdated: now };

        case 'STEP_STARTED':
            return {
                ...state,
                lastUpdated: now,
                steps: {
                    ...state.steps,
                    [action.stepIndex]: {
                        index: action.stepIndex,
                        agentType: action.agentType,
                        status: 'INITIALIZING'
                    }
                }
            };

        case 'STATE_UPDATE':
            if (!state.steps[action.stepIndex]) return state;
            return {
                ...state,
                lastUpdated: now,
                steps: {
                    ...state.steps,
                    [action.stepIndex]: {
                        ...state.steps[action.stepIndex],
                        status: action.state
                    }
                }
            };

        case 'STEP_OUTPUT':
            if (!state.steps[action.stepIndex]) return state;
            return {
                ...state,
                lastUpdated: now,
                steps: {
                    ...state.steps,
                    [action.stepIndex]: {
                        ...state.steps[action.stepIndex],
                        output: action.payload.output,
                        confidenceScore: action.payload.score,
                        status: 'SUCCEEDED'
                    }
                }
            };

        case 'HEAL_REQUIRED':
            return {
                ...state,
                lastUpdated: now,
                steps: {
                    ...state.steps,
                    [action.stepIndex]: {
                        ...state.steps[action.stepIndex],
                        status: 'HEALING'
                    }
                }
            };

        default:
            return state;
    }
};
