import React from 'react';
import type { StepState } from '../../store/types';

interface StepCardProps {
    step: StepState;
}

const statusStyles: Record<string, string> = {
    IDLE: 'bg-text-muted/10 text-text-secondary',
    INITIALIZING: 'bg-blue-500/10 text-blue-500',
    RUNNING: 'bg-text-primary/10 text-text-primary',
    SCORING: 'bg-purple-500/10 text-purple-500',
    SUCCEEDED: 'bg-success/10 text-success',
    HEALING: 'bg-warning/10 text-warning',
    REQUIRES_HITL: 'bg-warning/10 text-warning',
    AWAITING_HITL: 'bg-warning/10 text-warning',
    ROLLED_BACK: 'bg-warning/10 text-warning',
    FAILED: 'bg-destructive/10 text-destructive'
};

export const StepCard: React.FC<StepCardProps> = ({ step }) => {
    const isRunning = step.status === 'RUNNING';
    const badgeStyle = statusStyles[step.status] || statusStyles.IDLE;
    const leftBorder = step.status === 'FAILED'
        ? 'border-l-destructive'
        : step.status === 'HEALING'
            ? 'border-l-warning'
            : 'border-l-transparent';

    return (
        <div className={`w-full flex items-center justify-between border border-border bg-surface rounded-md border-l-2 ${leftBorder} px-4 py-3 mb-1`}>
            <div className="flex items-center gap-4 min-w-0">
                <span className="font-mono text-[11px] text-text-muted w-6">{String(step.index + 1).padStart(2, '0')}</span>
                <span className="text-[13px] font-semibold text-text-primary truncate">{step.agentType.replace('_WORKER', '')}</span>
                <div className="flex items-center">
                    <span data-badge className={`${badgeStyle} uppercase ${isRunning ? 'animate-pulse' : ''}`}>{step.status}</span>
                </div>
            </div>

            <div className="flex items-center gap-5">
                <div className="flex items-center gap-2 w-[132px]">
                    {step.confidenceScore !== undefined ? (
                        <>
                            <div className="w-[100px] h-[2px] bg-border overflow-hidden">
                                <div className="h-full bg-text-primary transition-all duration-80" style={{ width: `${step.confidenceScore}%` }} />
                            </div>
                            <span className="font-mono text-[11px] text-text-secondary">{step.confidenceScore}</span>
                        </>
                    ) : (
                        <span className="font-mono text-[11px] text-text-muted">WAITING</span>
                    )}
                </div>
                <span className="font-mono text-[11px] text-text-muted w-20 text-right">
                    {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
            </div>
        </div>
    );
};
