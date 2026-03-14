import React from 'react';
import type { StepState } from '../../store/types';

interface StepCardProps {
    step: StepState;
}

const statusColors: Record<string, string> = {
    IDLE: 'bg-gray-200 dark:bg-gray-800 text-gray-500',
    INITIALIZING: 'bg-blue-500/10 text-blue-500 border-l-blue-500',
    RUNNING: 'bg-fs-cyan/10 text-fs-cyan border-l-fs-cyan',
    SCORING: 'bg-purple-500/10 text-purple-500 border-l-purple-500',
    SUCCEEDED: 'bg-green-500/10 text-green-500 border-l-green-500',
    HEALING: 'bg-amber-500/15 text-amber-500 border-l-amber-500',
    AWAITING_HITL: 'bg-orange-500/10 text-orange-500 border-l-orange-500',
    ROLLED_BACK: 'bg-yellow-500/10 text-yellow-500 border-l-yellow-500',
    FAILED: 'bg-red-500/10 text-red-500 border-l-red-500'
};

export const StepCard: React.FC<StepCardProps> = ({ step }) => {
    const isRunning = step.status === 'RUNNING';
    const colorClass = statusColors[step.status] || statusColors.IDLE;

    return (
        <div className={`w-full flex items-center justify-between border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-surface-dark border-l-4 transition-colors duration-300 ${colorClass}`}>
            <div className="flex items-center space-x-6 py-4 px-6">
                <span className="font-mono text-xl opacity-50 w-8">{String(step.index + 1).padStart(2, '0')}</span>
                <span className="font-mono font-bold tracking-tight uppercase text-fs-text-light dark:text-fs-text-dark">{step.agentType.replace('_WORKER', '')} WORKER</span>
                <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm bg-black/5 dark:bg-white/5 uppercase ${isRunning ? 'animate-pulse' : ''}`}>{step.status}</span>
                </div>
            </div>

            <div className="flex items-center space-x-6 py-4 px-6">
                <div className="flex items-center space-x-3 w-40">
                    {step.confidenceScore !== undefined ? (
                        <>
                            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-fs-cyan transition-all duration-500" style={{ width: `${step.confidenceScore}%` }} />
                            </div>
                            <span className="font-mono text-sm">{step.confidenceScore}</span>
                        </>
                    ) : (
                        <span className="font-mono text-xs text-gray-400">WAITING SCORE</span>
                    )}
                </div>
                <span className="font-mono text-xs text-gray-400 w-20 text-right">
                    {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
            </div>
        </div>
    );
};
