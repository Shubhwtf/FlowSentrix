import React, { useEffect, useState } from 'react';
import { API } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import type { WorkflowRun, WorkflowDefinition } from '../../api/types';

export const RunsList: React.FC = () => {
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [workflows, setWorkflows] = useState<Record<string, WorkflowDefinition>>({});
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([
            API.runs.list(),
            API.workflows.list()
        ]).then(([r, w]) => {
            setRuns(r.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()));
            const wfMap: Record<string, WorkflowDefinition> = {};
            w.forEach(wf => wfMap[wf.id] = wf);
            setWorkflows(wfMap);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RUNNING': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
            case 'COMPLETED': return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'FAILED': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'HEALING': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'ROLLED_BACK': return 'text-fs-cyan bg-fs-cyan/10 border-fs-cyan/20';
            case 'AWAITING_HITL': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
        }
    };

    if (loading) {
        // Minimal loading state matching grid layout
        return <div className="p-8 text-gray-500 font-mono text-sm uppercase">Loading Runs...</div>;
    }

    return (
        <div className="flex flex-col h-full max-h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold font-mono tracking-tight text-fs-text-light dark:text-fs-text-dark uppercase">Agent Pipeline Runs</h2>
                </div>
                <div className="flex space-x-3">
                    <button className="px-4 py-2 border border-fs-border-light dark:border-fs-border-dark text-sm font-medium hover:bg-fs-surface-light dark:hover:bg-fs-surface-dark transition-colors">
                        EXPORT CSV
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-fs-cyan text-black text-sm font-medium hover:bg-opacity-90 transition-opacity flex items-center shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                        + NEW RUN
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-surface-dark custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-fs-border-light dark:border-fs-border-dark bg-gray-50 dark:bg-[#151515] text-xs font-mono uppercase tracking-wider text-gray-500">
                            <th className="p-4 font-medium">Run ID</th>
                            <th className="p-4 font-medium">Workflow Name</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium">Started At</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-fs-border-light dark:divide-fs-border-dark font-mono text-sm">
                        {runs.map(run => (
                            <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-fs-bg-dark transition-colors group">
                                <td className="p-4 text-gray-500 truncate max-w-[120px]" title={run.id}>
                                    {run.id.split('-')[0]}...
                                </td>
                                <td className="p-4 font-medium text-fs-text-light dark:text-fs-text-dark">
                                    {workflows[run.workflow_id]?.name || 'Unknown Workflow'}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-xs border ${getStatusColor(run.status)}`}>
                                        {run.status}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-500">
                                    {new Date(run.started_at).toLocaleString()}
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => navigate(`/?run=${run.id}`)}
                                        className="text-fs-cyan hover:text-white uppercase text-xs font-bold tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        View Dashboard →
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {runs.length === 0 && (
                    <div className="p-8 text-center text-gray-500 font-mono text-sm">
                        No runs found. Start a new workflow run from the dashboard.
                    </div>
                )}
            </div>
        </div>
    );
};
