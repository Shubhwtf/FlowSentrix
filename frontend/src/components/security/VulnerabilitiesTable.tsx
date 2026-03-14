import React from 'react';

const mockVulnerabilities = [
    { cve: 'CVE-2024-21626', score: 9.8, repo: 'flow-core', status: 'detected' },
    { cve: 'CVE-2023-44487', score: 7.5, repo: 'api-gateway', status: 'fix-generated' },
    { cve: 'CVE-2023-38545', score: 4.2, repo: 'frontend-ui', status: 'pr-open' },
    { cve: 'CVE-2023-45133', score: 2.1, repo: 'auth-service', status: 'resolved' },
];

export const VulnerabilitiesTable: React.FC = () => {
    const getScoreColor = (score: number) => {
        if (score >= 9) return 'bg-red-500 text-white';
        if (score >= 7) return 'bg-orange-500 text-white';
        if (score >= 4) return 'bg-amber-500 text-black';
        return 'bg-green-500 text-white';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'detected': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'fix-generated': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'pr-open': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'resolved': return 'bg-green-500/10 text-green-500 border-green-500/20';
            default: return 'bg-gray-100 text-gray-500';
        }
    };

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark flex flex-col h-[500px]">
            <div className="p-4 border-b border-fs-border-light dark:border-fs-border-dark flex justify-between items-center">
                <h3 className="font-bold tracking-tight">Active Vulnerabilities (CVEs)</h3>
                <button className="text-xs font-mono text-fs-cyan hover:underline">Scan Now</button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left font-mono text-sm">
                    <thead className="bg-fs-surface-light dark:bg-fs-bg-dark border-b border-fs-border-light dark:border-fs-border-dark text-xs uppercase tracking-wider text-gray-500 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 font-semibold">CVE ID</th>
                            <th className="px-4 py-3 font-semibold text-center w-20">Score</th>
                            <th className="px-4 py-3 font-semibold">Repository</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-fs-border-light dark:divide-fs-border-dark">
                        {mockVulnerabilities.map(v => (
                            <tr key={v.cve} className="hover:bg-fs-surface-light dark:hover:bg-black/20 transition-colors">
                                <td className="px-4 py-3 font-bold">{v.cve}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-sm ${getScoreColor(v.score)}`}>{v.score.toFixed(1)}</span>
                                </td>
                                <td className="px-4 py-3 font-sans text-xs">{v.repo}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded-sm ${getStatusColor(v.status)}`}>
                                        {v.status.replace('-', ' ')}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {v.status === 'detected' && <button className="text-xs bg-fs-cyan text-black px-3 py-1 font-bold">Fix</button>}
                                    {v.status === 'fix-generated' && <button className="text-xs bg-purple-500 text-white px-3 py-1 font-bold">PR</button>}
                                    {(v.status === 'pr-open' || v.status === 'resolved') && <button className="text-xs text-gray-500 underline">View</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
