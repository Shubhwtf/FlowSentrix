import React from 'react';
import { StepCard } from './StepCard';
import type { RunState } from '../../store/types';

interface RunTimelineProps {
    runState: RunState | null;
}

export const RunTimeline: React.FC<RunTimelineProps> = ({ runState }) => {
    if (!runState || !runState.workflowId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-fs-border-light dark:border-fs-border-dark p-12 text-gray-500">
                <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-700 mb-4"></div>
                <p className="font-mono text-sm uppercase">Waiting for Active Run</p>
                <p className="text-xs mt-2 max-w-sm text-center">Trigger a new run via the New Run button or await an incoming SSE connection.</p>
            </div>
        );
    }

    const steps = Object.values(runState.steps).sort((a, b) => a.index - b.index);

    return (
        <div className="flex-1 flex flex-col space-y-3 overflow-y-auto pr-2 pb-4">
            {steps.map(step => (
                <StepCard key={step.index} step={step} />
            ))}
        </div>
    );
};
