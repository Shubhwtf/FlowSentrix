import React from 'react';

const mockHitlEvents = [
    { id: '1', workflow: 'EMPLOYEE_ONBOARDING', runId: 'run_12345', step: 4, timestamp: Date.now() - 120000, status: 'PENDING' },
    { id: '2', workflow: 'SECURITY_SCAN', runId: 'run_98765', step: 2, timestamp: Date.now() - 86400000, status: 'RESOLVED' },
];

export const HITLQueue: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight">HITL Escalation Queue</h1>
                <span className="font-mono text-sm px-3 py-1 bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark">1 PENDING</span>
            </div>

            <div className="space-y-4">
                {mockHitlEvents.map(event => (
                    <div key={event.id} className={`p-5 flex items-center justify-between border bg-white dark:bg-fs-surface-dark transition-colors ${event.status === 'PENDING' ? 'border-fs-border-light dark:border-fs-border-dark shadow-sm' : 'border-dashed border-gray-200 dark:border-gray-800 opacity-50'}`}>
                        <div className="flex items-center space-x-6">
                            <div className="relative">
                                {event.status === 'PENDING' && (
                                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                )}
                                <div className="w-12 h-12 bg-fs-surface-light dark:bg-fs-bg-dark border border-fs-border-light dark:border-fs-border-dark flex items-center justify-center font-mono font-bold text-lg">
                                    {event.step.toString().padStart(2, '0')}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{event.workflow.replace(/_/g, ' ')}</h3>
                                <div className="flex space-x-3 text-xs font-mono text-gray-500 mt-1 uppercase">
                                    <span>{event.runId}</span>
                                    <span>•</span>
                                    <span>WAITING {Math.floor((Date.now() - event.timestamp) / 60000)} MIN</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            {event.status === 'PENDING' ? (
                                <button className="bg-fs-cyan text-black px-6 py-2 font-medium hover:bg-opacity-90">REVIEW</button>
                            ) : (
                                <span className="font-mono text-xs px-3 py-1 bg-fs-surface-light dark:bg-black uppercase">Resolved</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
