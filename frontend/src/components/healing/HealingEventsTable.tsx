import React from 'react';

const mockHealingEvents = [
    { id: 'h1', runId: 'run_12345', workflow: 'Employee Onboarding', step: 4, type: 'proactive', attempts: 2, outcome: 'healed', duration: '1.2s' },
    { id: 'h2', runId: 'run_99912', workflow: 'Compliance Check', step: 8, type: 'reactive', attempts: 3, outcome: 'hitl', duration: '8.4s' },
    { id: 'h3', runId: 'run_00019', workflow: 'Security Scan', step: 1, type: 'rollback', attempts: 1, outcome: 'rolled back', duration: '0.4s' }
];

export const HealingEventsTable: React.FC = () => {
    const getTypeColor = (type: string) => {
        switch (type) {
            case 'proactive': return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
            case 'reactive': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'rollback': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            default: return 'bg-gray-100 text-gray-500';
        }
    };

    const getOutcomeColor = (outcome: string) => {
        switch (outcome) {
            case 'healed': return 'text-green-500';
            case 'hitl': return 'text-red-500';
            case 'rolled back': return 'text-orange-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Healing Event Ledger</h1>
                <div className="flex space-x-2">
                    <button className="px-3 py-1.5 text-xs font-mono border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-surface-dark hover:bg-gray-50 dark:hover:bg-fs-bg-dark transition-colors">ALL EVENTS</button>
                    <button className="px-3 py-1.5 text-xs font-mono border border-transparent text-gray-500 hover:text-fs-text-light dark:hover:text-fs-text-dark transition-colors">ROLLBACKS ONLY</button>
                </div>
            </div>

            <div className="border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-surface-dark overflow-hidden">
                <table className="w-full text-left font-mono text-sm">
                    <thead className="bg-fs-surface-light dark:bg-fs-bg-dark border-b border-fs-border-light dark:border-fs-border-dark text-xs uppercase tracking-wider text-gray-500">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Run ID</th>
                            <th className="px-6 py-4 font-semibold">Workflow</th>
                            <th className="px-6 py-4 font-semibold">Step</th>
                            <th className="px-6 py-4 font-semibold">Type</th>
                            <th className="px-6 py-4 font-semibold text-center">Attempts</th>
                            <th className="px-6 py-4 font-semibold">Duration</th>
                            <th className="px-6 py-4 font-semibold">Outcome</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-fs-border-light dark:divide-fs-border-dark">
                        {mockHealingEvents.map((row, i) => (
                            <tr key={i} className="hover:bg-fs-surface-light dark:hover:bg-black/20 transition-colors cursor-pointer group">
                                <td className="px-6 py-4 truncate max-w-[120px]">{row.runId}</td>
                                <td className="px-6 py-4 font-sans">{row.workflow}</td>
                                <td className="px-6 py-4">{row.step.toString().padStart(2, '0')}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded-sm ${getTypeColor(row.type)}`}>
                                        {row.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">{row.attempts}/3</td>
                                <td className="px-6 py-4">{row.duration}</td>
                                <td className={`px-6 py-4 font-bold uppercase text-[10px] tracking-wider flex items-center space-x-2 ${getOutcomeColor(row.outcome)}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${getOutcomeColor(row.outcome).replace('text-', 'bg-')}`}></div>
                                    <span>{row.outcome}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
