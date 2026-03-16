import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';

interface Vulnerability {
    id: string;
    cve_id: string;
    severity_score: number | null;
    repo: string | null;
    file_path: string | null;
    llm_fix: unknown;
    pr_url: string | null;
    status: string | null;
}

export const VulnerabilitiesTable: React.FC = () => {
    const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        API.security.listVulnerabilities()
            .then((data) => setVulnerabilities(data as Vulnerability[]))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const getScoreColor = (score: number | null) => {
        const s = score ?? 0;
        if (s >= 9) return 'bg-red-500 text-white';
        if (s >= 7) return 'bg-orange-500 text-white';
        if (s >= 4) return 'bg-amber-500 text-black';
        return 'bg-green-500 text-white';
    };

    const getStatusColor = (status: string | null) => {
        switch (status) {
            case 'open': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'fix-generated': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'pr-open': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'resolved': return 'bg-green-500/10 text-green-500 border-green-500/20';
            default: return 'bg-gray-100 text-gray-500';
        }
    };

    const handleFix = async (id: string) => {
        try {
            await API.security.fixVulnerability(id);
            const updated = await API.security.listVulnerabilities();
            setVulnerabilities(updated as Vulnerability[]);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark flex flex-col h-[500px]">
            <div className="p-4 border-b border-fs-border-light dark:border-fs-border-dark flex justify-between items-center">
                <h3 className="font-bold tracking-tight">Active Vulnerabilities (CVEs)</h3>
                <button
                    className="text-xs font-mono text-fs-cyan hover:underline"
                    onClick={() => API.security.scan({})}
                >
                    Scan Now
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-6 h-6 border-2 border-fs-cyan border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
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
                            {vulnerabilities.map(v => (
                                <tr key={v.id} className="hover:bg-fs-surface-light dark:hover:bg-black/20 transition-colors">
                                    <td className="px-4 py-3 font-bold">{v.cve_id}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-sm ${getScoreColor(Number(v.severity_score))}`}>{(Number(v.severity_score) || 0).toFixed(1)}</span>
                                    </td>
                                    <td className="px-4 py-3 font-sans text-xs">{v.repo ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded-sm ${getStatusColor(v.status)}`}>
                                            {(v.status ?? 'unknown').replace('-', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {v.status === 'open' && <button className="text-xs bg-fs-cyan text-black px-3 py-1 font-bold" onClick={() => handleFix(v.id)}>Fix</button>}
                                        {v.status === 'fix-generated' && <button className="text-xs bg-purple-500 text-white px-3 py-1 font-bold">PR</button>}
                                        {v.pr_url && <a href={v.pr_url} target="_blank" rel="noreferrer" className="text-xs text-gray-500 underline ml-2">View PR</a>}
                                    </td>
                                </tr>
                            ))}
                            {vulnerabilities.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-xs font-mono">No vulnerabilities found.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
