import React, { useEffect, useState } from 'react';
import { API } from '../../api/client';
import { useNavigate } from 'react-router-dom';

export const HealingEventsTable: React.FC = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        API.healing.list().then(data => { setEvents(data); setLoading(false); }).catch(e => { console.error(e); setLoading(false); });
    }, []);

    const getOutcomeStyle = (outcome: string) => {
        switch (outcome?.toUpperCase()) {
            case 'RESOLVED': return { dot: 'bg-green-500', text: 'text-green-500' };
            case 'ESCALATED_HITL': return { dot: 'bg-red-500', text: 'text-red-500' };
            default: return { dot: 'bg-amber-500', text: 'text-amber-500' };
        }
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight font-mono uppercase">Healing Event Ledger</h1>
                <span className="font-mono text-xs px-3 py-1 bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark">{events.length} EVENTS</span>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500 font-mono text-sm">Loading healing events...</div>
            ) : (
                <div className="border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-surface-dark overflow-hidden">
                    <table className="w-full text-left font-mono text-sm">
                        <thead className="bg-fs-surface-light dark:bg-fs-bg-dark border-b border-fs-border-light dark:border-fs-border-dark text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Run ID</th>
                                <th className="px-6 py-4 font-semibold">Step ID</th>
                                <th className="px-6 py-4 font-semibold">Event Type</th>
                                <th className="px-6 py-4 font-semibold text-center">Attempts</th>
                                <th className="px-6 py-4 font-semibold">Diagnosis</th>
                                <th className="px-6 py-4 font-semibold">Timestamp</th>
                                <th className="px-6 py-4 font-semibold">Outcome</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-fs-border-light dark:divide-fs-border-dark">
                            {events.map((row) => {
                                const style = getOutcomeStyle(row.outcome);
                                const strategies = Array.isArray(row.strategies_tried) ? row.strategies_tried : (typeof row.strategies_tried === 'string' ? (() => { try { return JSON.parse(row.strategies_tried || '[]'); } catch { return []; } })() : []);
                                const diagnosis = Array.isArray(row.llm_diagnosis) ? row.llm_diagnosis[0] : (typeof row.llm_diagnosis === 'string' ? row.llm_diagnosis : null);
                                return (
                                    <tr key={row.id} onClick={() => navigate(`/?run=${row.run_id}`)} className="hover:bg-fs-surface-light dark:hover:bg-black/20 transition-colors cursor-pointer group">
                                        <td className="px-6 py-4 text-fs-cyan truncate max-w-[100px]" title={row.run_id}>{row.run_id.split('-')[0]}…</td>
                                        <td className="px-6 py-4 text-gray-500 truncate max-w-[100px]" title={row.step_id}>{row.step_id?.split('-')[0]}…</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-400">
                                                {row.event_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">{strategies.length}/3</td>
                                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{diagnosis?.rootCause || 'Unknown'} — {diagnosis?.strategy || 'Retry'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <div className={`flex items-center space-x-2 font-bold uppercase text-[10px] tracking-wider ${style.text}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                <span>{row.outcome || 'PENDING'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {events.length === 0 && (
                        <div className="p-8 text-center text-gray-500 font-mono text-sm">
                            No healing events yet. Trigger a run with failure injection to see the Healer Agent in action.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
