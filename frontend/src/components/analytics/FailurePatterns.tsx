import React from 'react';

const failures = [
    { rank: 1, desc: 'API Rate Limit Exceeded (GitHub)', count: 42, pct: 100 },
    { rank: 2, desc: 'Missing Required Payload JSON schema', count: 28, pct: 66 },
    { rank: 3, desc: 'Timeout waiting for IDP synchronization', count: 15, pct: 35 },
    { rank: 4, desc: 'Stale OAuth Token on Microsoft Graph', count: 11, pct: 26 },
    { rank: 5, desc: 'Database lock contention during burst', count: 4, pct: 9 },
];

export const FailurePatterns: React.FC = () => {
    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 h-80 flex flex-col overflow-hidden">
            <h3 className="font-bold tracking-tight mb-4">Top Failure Patterns</h3>

            <div className="flex-1 flex flex-col space-y-3 relative">
                {failures.map((f) => (
                    <div key={f.rank} className="flex items-center justify-between group cursor-pointer hover:bg-fs-surface-light dark:hover:bg-black/20 p-2 -mx-2 rounded transition-colors">
                        <div className="flex items-center space-x-3 overflow-hidden pr-4">
                            <span className="font-mono text-xs text-gray-400 bg-fs-surface-light dark:bg-black px-1.5 py-0.5">{f.rank}</span>
                            <span className="text-sm truncate font-medium">{f.desc}</span>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                            <div className="w-16 h-1.5 bg-fs-surface-light dark:bg-black">
                                <div className="h-full bg-red-500" style={{ width: `${f.pct}%` }}></div>
                            </div>
                            <span className="font-mono text-xs font-bold w-6 text-right">{f.count}</span>
                        </div>
                    </div>
                ))}

                <div className="absolute bottom-0 w-full pt-4 border-t border-dashed border-fs-border-light dark:border-fs-border-dark text-center">
                    <button className="text-xs font-mono text-fs-cyan hover:underline">View All Patterns →</button>
                </div>
            </div>
        </div>
    );
};
