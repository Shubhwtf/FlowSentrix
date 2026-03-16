import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';

interface RiskFlag {
    id: string;
    risk_score: number | null;
    category: string | null;
    signals: unknown;
    correlation_group_id: string | null;
    acknowledged_by: string | null;
    acknowledged_at: unknown;
}

export const RiskFeedView: React.FC = () => {
    const [flags, setFlags] = useState<RiskFlag[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [acknowledging, setAcknowledging] = useState<string | null>(null);

    const loadFlags = () => {
        API.risks.listActive()
            .then((data) => setFlags(data as RiskFlag[]))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        loadFlags();
    }, []);

    const handleAcknowledge = async (id: string) => {
        setAcknowledging(id);
        try {
            await API.risks.acknowledge(id);
            setFlags(prev => prev.filter(f => f.id !== id));
        } catch (e) {
            console.error(e);
        } finally {
            setAcknowledging(null);
        }
    };

    const getScoreColor = (score: number | null) => {
        const s = score ?? 0;
        if (s >= 9) return 'bg-red-500 text-white';
        if (s >= 7) return 'bg-orange-500 text-white';
        if (s >= 4) return 'bg-amber-500 text-black';
        return 'bg-green-500 text-white';
    };

    const parseSignals = (raw: unknown): string[] => {
        if (!raw) return [];
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (Array.isArray(parsed)) return parsed as string[];
            return Object.keys(parsed);
        } catch {
            return [];
        }
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h1 className="text-2xl font-bold tracking-tight">Active Risk Monitor</h1>
                <span className="font-mono text-xs px-3 py-1 bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark">
                    {flags.length} ACTIVE FLAGS
                </span>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center flex-1">
                    <div className="w-6 h-6 border-2 border-fs-cyan border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-4 relative">
                    <div className="absolute left-10 top-0 bottom-0 w-px bg-fs-border-light dark:bg-fs-border-dark hidden md:block" />

                    {flags.map(flag => {
                        const signals = parseSignals(flag.signals);
                        return (
                            <div key={flag.id} className="relative flex items-center md:space-x-8">
                                <div className="w-20 hidden md:flex items-center justify-center z-10 font-mono text-xs text-gray-500 bg-fs-bg-light dark:bg-fs-bg-dark pt-1">
                                    {flag.correlation_group_id ?? 'GRP'}
                                </div>

                                <div className="flex-1 bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-4 flex flex-col transition-colors hover:border-fs-cyan cursor-crosshair">
                                    <div className="flex justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <span className={`font-mono text-lg font-bold px-2 py-0.5 ${getScoreColor(flag.risk_score)}`}>{(flag.risk_score ?? 0).toFixed(1)}</span>
                                            <span className="font-bold tracking-tight">{flag.category ?? 'Unknown'} Anomaly</span>
                                        </div>
                                        <span className="font-mono text-xs text-gray-400">{flag.id.slice(0, 8)}</span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {signals.map(s => (
                                            <span key={s} className="font-mono text-[10px] uppercase bg-black/5 dark:bg-white/5 border border-fs-border-light dark:border-fs-border-dark px-1.5 py-0.5 text-gray-500">{s}</span>
                                        ))}
                                    </div>

                                    <div className="flex justify-between items-center pt-3 border-t border-fs-border-light dark:border-fs-border-dark">
                                        <div className="flex items-center space-x-2 font-mono text-xs uppercase">
                                            <span className="text-gray-500">Score:</span>
                                            <span className="text-fs-cyan tracking-wider">{flag.risk_score}</span>
                                        </div>
                                        <button
                                            onClick={() => handleAcknowledge(flag.id)}
                                            disabled={acknowledging === flag.id}
                                            className="text-[10px] font-mono font-bold uppercase border border-fs-border-light dark:border-fs-border-dark px-3 py-1 hover:bg-fs-surface-light dark:hover:bg-black/20 transition-colors disabled:opacity-50"
                                        >
                                            {acknowledging === flag.id ? 'ACKING...' : 'ACKNOWLEDGE'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {flags.length === 0 && (
                        <div className="text-center py-16 text-gray-500 font-mono text-sm">No active risk flags.</div>
                    )}
                </div>
            )}
        </div>
    );
};
