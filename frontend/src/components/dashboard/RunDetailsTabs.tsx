import React, { useEffect, useState } from 'react';
import { API } from '../../api/client';
import { TerminalSquare, HeartPulse, CheckCircle, AlertTriangle } from 'lucide-react';
import { EventLog } from './EventLog';

export const RunDetailsTabs: React.FC<{ runId: string; allEvents: any[] }> = ({ runId, allEvents }) => {
    const [activeTab, setActiveTab] = useState<'events' | 'healing'>('events');
    const [healingEvents, setHealingEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!runId) return;
        let isMounted = true;
        setLoading(true);
        API.runs.getHealingEvents(runId)
            .then(h => {
                if (!isMounted) return;
                setHealingEvents(h || []);
                setLoading(false);
            })
            .catch(() => {
                if (isMounted) setLoading(false);
            });
        return () => { isMounted = false; };
    }, [runId]);

    const tabs = [
        { id: 'events', label: 'Event Log', icon: TerminalSquare, count: null },
        { id: 'healing', label: 'Healing Events', icon: HeartPulse, count: healingEvents.length }
    ] as const;

    const renderHealing = () => {
        if (loading) return <div className="p-4 text-xs text-gray-500 font-mono">Loading...</div>;
        if (healingEvents.length === 0) return <div className="p-4 text-xs text-gray-500 font-mono italic">No healing events found for this run.</div>;

        return (
            <div className="overflow-y-auto h-full custom-scrollbar p-4 space-y-6 bg-fs-surface-light dark:bg-black font-mono">
                {healingEvents.map((evt, i) => {
                    let strategies: any[] = [];
                    try {
                        const raw = evt.strategies_tried || evt.llm_diagnosis;
                        strategies = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        if (!Array.isArray(strategies)) strategies = [strategies];
                    } catch { }

                    const isResolved = evt.outcome === 'RESOLVED';

                    return (
                        <div key={i} className="border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-surface-dark overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-fs-border-light dark:border-fs-border-dark bg-fs-surface-light dark:bg-fs-bg-dark">
                                <div className="flex items-center space-x-3">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Step {evt.step_id?.substring(0, 8)}</span>
                                    {isResolved ? <CheckCircle size={14} className="text-green-500" /> : <AlertTriangle size={14} className="text-red-500" />}
                                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isResolved ? 'text-green-500' : 'text-red-500'}`}>
                                        {evt.outcome}
                                    </span>
                                </div>
                                <span className="text-[10px] text-gray-500">{new Date(evt.created_at).toLocaleTimeString()}</span>
                            </div>

                            <div className="p-4 space-y-4">
                                {strategies.length > 0 ? strategies.map((strat, idx) => (
                                    <div key={idx} className="flex space-x-4 border-l-2 pl-4 border-fs-border-light dark:border-gray-800 relative">
                                        <div className="absolute -left-2 top-0 w-3.5 h-3.5 rounded-full bg-fs-bg-dark border border-gray-600 flex items-center justify-center">
                                            <span className="text-[8px] text-gray-400 font-bold">{idx + 1}</span>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div>
                                                <span className="text-[10px] uppercase tracking-widest text-amber-500 font-bold block mb-1">Diagnosis / Root Cause</span>
                                                <p className="text-xs text-gray-600 dark:text-gray-300 bg-black/5 dark:bg-black/20 p-2 rounded-sm border border-fs-border-light dark:border-fs-border-dark">{strat.rootCause || 'Unknown'}</p>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase tracking-widest text-fs-cyan font-bold block mb-1">Execution Strategy</span>
                                                <p className="text-xs text-gray-600 dark:text-gray-300 bg-black/5 dark:bg-black/20 p-2 rounded-sm border border-fs-border-light dark:border-fs-border-dark">{strat.strategy || 'Retry'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-xs text-gray-500 italic">No structured strategy log available.</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-black mt-4 flex flex-col font-mono shadow-inner min-h-[16rem] h-64">
            <div className="flex items-center border-b border-fs-border-light dark:border-fs-border-dark bg-fs-surface-light dark:bg-fs-surface-dark overflow-x-auto custom-scrollbar">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        className={`flex items-center space-x-2 px-4 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-colors whitespace-nowrap border-b-2 ${activeTab === t.id ? 'border-fs-cyan text-fs-text-light dark:text-fs-text-dark bg-white/5 dark:bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    >
                        <t.icon size={12} />
                        <span>{t.label}</span>
                        {t.count !== null && t.count > 0 && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] ${activeTab === t.id ? 'bg-fs-cyan text-black' : 'bg-gray-700 text-white'}`}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
            <div className="flex-1 bg-white dark:bg-black overflow-hidden relative">
                {activeTab === 'events' && <div className="absolute inset-0"><EventLog events={allEvents} /></div>}
                {activeTab === 'healing' && renderHealing()}
            </div>
        </div>
    );
};
