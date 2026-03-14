import React from 'react';

const mockFlags = [
    { id: 'RSK-991', score: 9.1, category: 'Infrastructure', signals: ['high-cpu', 'db-lock', 'latency-spike'], action: 'Scale Read Replicas', time: '12m ago' },
    { id: 'RSK-842', score: 8.4, category: 'Security', signals: ['auth-failure-burst', 'foreign-ip'], action: 'Block IP Range', time: '45m ago' },
    { id: 'RSK-611', score: 6.1, category: 'Compliance', signals: ['unencrypted-s3-bucket-created'], action: 'Enforce Encryption Policy', time: '2h ago' },
];

export const RiskFeedView: React.FC = () => {
    const getScoreColor = (score: number) => {
        if (score >= 9) return 'bg-red-500 text-white';
        if (score >= 7) return 'bg-orange-500 text-white';
        if (score >= 4) return 'bg-amber-500 text-black';
        return 'bg-green-500 text-white';
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h1 className="text-2xl font-bold tracking-tight">Active Risk Monitor</h1>
                <span className="font-mono text-xs px-3 py-1 bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark">3 ACTIVE FLAGS</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 relative">
                <div className="absolute left-10 top-0 bottom-0 w-px bg-fs-border-light dark:bg-fs-border-dark hidden md:block"></div>

                {mockFlags.map(flag => (
                    <div key={flag.id} className="relative flex items-center md:space-x-8">
                        <div className="w-20 hidden md:flex items-center justify-center z-10 font-mono text-xs text-gray-500 bg-fs-bg-light dark:bg-fs-bg-dark pt-1">
                            {flag.time}
                        </div>

                        <div className="flex-1 bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-4 flex flex-col transition-colors hover:border-fs-cyan cursor-crosshair">
                            <div className="flex justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                    <span className={`font-mono text-lg font-bold px-2 py-0.5 ${getScoreColor(flag.score)}`}>{flag.score.toFixed(1)}</span>
                                    <span className="font-bold tracking-tight">{flag.category} Anomaly</span>
                                </div>
                                <span className="font-mono text-xs text-gray-400">{flag.id}</span>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-4">
                                {flag.signals.map(s => (
                                    <span key={s} className="font-mono text-[10px] uppercase bg-black/5 dark:bg-white/5 border border-fs-border-light dark:border-fs-border-dark px-1.5 py-0.5 text-gray-500">{s}</span>
                                ))}
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-fs-border-light dark:border-fs-border-dark">
                                <div className="flex items-center space-x-2 font-mono text-xs uppercase">
                                    <span className="text-gray-500">Rec. Action:</span>
                                    <span className="text-fs-cyan tracking-wider">{flag.action}</span>
                                </div>
                                <button className="text-[10px] font-mono font-bold uppercase border border-fs-border-light dark:border-fs-border-dark px-3 py-1 hover:bg-fs-surface-light dark:hover:bg-black/20 transition-colors">Acknowledge</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
