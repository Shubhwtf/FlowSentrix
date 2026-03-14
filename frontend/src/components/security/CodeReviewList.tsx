import React from 'react';

const mockReviews = [
    { pr: 'Feature: OAuth2 flow update', repo: 'auth-service', verdict: 'request-changes', findings: { security: 2, logic: 1, style: 4 } },
    { pr: 'Fix: Database deadlocks', repo: 'flow-core', verdict: 'approved', findings: { security: 0, logic: 0, style: 2 } },
    { pr: 'Draft: New agent orchestration', repo: 'flow-core', verdict: 'critical-block', findings: { security: 1, logic: 3, style: 12 } },
];

export const CodeReviewList: React.FC = () => {
    const getVerdictColor = (v: string) => {
        switch (v) {
            case 'approved': return 'text-green-500';
            case 'request-changes': return 'text-amber-500';
            case 'critical-block': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-dark flex flex-col h-[500px]">
            <div className="p-4 border-b border-fs-border-light dark:border-fs-border-dark flex justify-between items-center">
                <h3 className="font-bold tracking-tight">Recent Code Reviews</h3>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-fs-border-light dark:divide-fs-border-dark">
                {mockReviews.map((r, i) => (
                    <div key={i} className="p-4 hover:bg-fs-surface-light dark:hover:bg-black/20 transition-colors cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-sm tracking-tight truncate">{r.pr}</h4>
                            <span className={`font-mono text-[10px] uppercase font-bold tracking-wider ${getVerdictColor(r.verdict)}`}>
                                {r.verdict.replace('-', ' ')}
                            </span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="font-mono text-xs text-gray-500">{r.repo}</span>
                            <div className="flex space-x-2 font-mono text-[10px]">
                                <div className="flex items-center space-x-1" title="Security Findings">
                                    <span className="text-gray-500">SEC</span>
                                    <span className={`w-5 text-center rounded-sm ${r.findings.security > 0 ? 'bg-red-500/20 text-red-500' : 'bg-fs-surface-light dark:bg-black text-gray-500'}`}>{r.findings.security}</span>
                                </div>
                                <div className="flex items-center space-x-1" title="Logic Findings">
                                    <span className="text-gray-500">LOG</span>
                                    <span className={`w-5 text-center rounded-sm ${r.findings.logic > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-fs-surface-light dark:bg-black text-gray-500'}`}>{r.findings.logic}</span>
                                </div>
                                <div className="flex items-center space-x-1" title="Style Findings">
                                    <span className="text-gray-500">STY</span>
                                    <span className={`w-5 text-center rounded-sm ${r.findings.style > 0 ? 'bg-cyan-500/20 text-cyan-500' : 'bg-fs-surface-light dark:bg-black text-gray-500'}`}>{r.findings.style}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
