import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [lineCoordinates, setLineCoordinates] = useState<Array<{ x1: number; y1: number; x2: number; y2: number; groupId: string; key: string }>>([]);

    const calculateLines = useCallback(() => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const grouped: Record<string, string[]> = {};
        flags.forEach(f => {
            if (!f.correlation_group_id) return;
            if (!grouped[f.correlation_group_id]) grouped[f.correlation_group_id] = [];
            grouped[f.correlation_group_id].push(f.id);
        });
        const lines: Array<{ x1: number; y1: number; x2: number; y2: number; groupId: string; key: string }> = [];
        Object.entries(grouped).forEach(([groupId, ids]) => {
            if (ids.length < 2) return;
            for (let i = 0; i < ids.length - 1; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const aEl = cardRefs.current[ids[i]];
                    const bEl = cardRefs.current[ids[j]];
                    if (!aEl || !bEl) continue;
                    const aRect = aEl.getBoundingClientRect();
                    const bRect = bEl.getBoundingClientRect();
                    lines.push({
                        x1: aRect.left + aRect.width / 2 - containerRect.left,
                        y1: aRect.top + aRect.height / 2 - containerRect.top,
                        x2: bRect.left + bRect.width / 2 - containerRect.left,
                        y2: bRect.top + bRect.height / 2 - containerRect.top,
                        groupId,
                        key: `${ids[i]}-${ids[j]}`
                    });
                }
            }
        });
        setLineCoordinates(lines);
    }, [flags]);

    const loadFlags = () => {
        API.risks.listActive()
            .then((data) => {
                if (Array.isArray(data)) {
                    const normalized = data
                        .filter((entry) => typeof entry === 'object' && entry !== null)
                        .map((entry) => {
                            const id = typeof entry.id === 'string' ? entry.id : '';
                            const risk_score = typeof entry.risk_score === 'number' ? entry.risk_score : null;
                            const category = typeof entry.category === 'string' ? entry.category : null;
                            const correlation_group_id = typeof entry.correlation_group_id === 'string' ? entry.correlation_group_id : null;
                            const acknowledged_by = typeof entry.acknowledged_by === 'string' ? entry.acknowledged_by : null;
                            return {
                                id,
                                risk_score,
                                category,
                                signals: entry.signals,
                                correlation_group_id,
                                acknowledged_by,
                                acknowledged_at: entry.acknowledged_at
                            };
                        });
                    setFlags(normalized);
                } else {
                    setFlags([]);
                }
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        loadFlags();
    }, []);

    useEffect(() => {
        calculateLines();
    }, [calculateLines]);

    useEffect(() => {
        window.addEventListener('resize', calculateLines);
        return () => window.removeEventListener('resize', calculateLines);
    }, [calculateLines]);

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
            if (Array.isArray(parsed)) {
                return parsed.filter((entry) => typeof entry === 'string');
            }
            return Object.keys(parsed);
        } catch {
            return [];
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h1 className="text-[20px] font-bold tracking-tight">Active Risk Monitor</h1>
                <span data-badge className="bg-surface-elevated border border-border">
                    {flags.length} ACTIVE FLAGS
                </span>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center flex-1">
                    <div className="w-6 h-6 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div ref={containerRef} className="flex-1 overflow-y-auto space-y-4 relative">
                    <div className="absolute left-10 top-0 bottom-0 w-px bg-border hidden md:block" />

                    {flags.map(flag => {
                        const signals = parseSignals(flag.signals);
                        return (
                            <div key={flag.id} ref={el => { cardRefs.current[flag.id] = el; }} className="relative flex items-center md:space-x-8">
                                <div className="w-20 hidden md:flex items-center justify-center z-10 font-mono text-xs text-text-secondary bg-background pt-1">
                                    {flag.correlation_group_id ?? 'GRP'}
                                </div>

                                <div className="flex-1 bg-surface border border-border rounded-md p-4 flex flex-col hover:border-text-primary cursor-crosshair">
                                    <div className="flex justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <span className={`font-mono text-lg font-bold px-2 py-0.5 ${getScoreColor(flag.risk_score)}`}>{(flag.risk_score ?? 0).toFixed(1)}</span>
                                            <span className="font-bold tracking-tight">{flag.category ?? 'Unknown'} Anomaly</span>
                                        </div>
                                        <span className="font-mono text-xs text-text-muted">{flag.id.slice(0, 8)}</span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {signals.map(s => (
                                            <span key={s} data-badge className="uppercase bg-surface-elevated border border-border text-text-secondary">{s}</span>
                                        ))}
                                    </div>

                                    <div className="flex justify-between items-center pt-3 border-t border-border">
                                        <div className="flex items-center space-x-2 font-mono text-xs uppercase">
                                            <span className="text-text-secondary">Score:</span>
                                            <span className="text-text-primary tracking-wider">{flag.risk_score}</span>
                                        </div>
                                        <button
                                            onClick={() => handleAcknowledge(flag.id)}
                                            disabled={acknowledging === flag.id}
                                            className="text-[10px] font-mono font-bold uppercase border border-border px-3 py-1 hover:bg-surface-elevated disabled:opacity-50"
                                        >
                                            {acknowledging === flag.id ? 'ACKING...' : 'ACKNOWLEDGE'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {flags.length === 0 && (
                        <div className="text-center py-16 text-text-secondary font-mono text-sm">No active risk flags.</div>
                    )}

                    {lineCoordinates.length > 0 && (
                        <svg
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
                        >
                            {lineCoordinates.map(line => (
                                <line
                                    key={line.key}
                                    x1={line.x1}
                                    y1={line.y1}
                                    x2={line.x2}
                                    y2={line.y2}
                                    stroke="var(--text-primary)"
                                    strokeOpacity={0.3}
                                    strokeWidth={1.5}
                                    strokeDasharray="4 4"
                                />
                            ))}
                        </svg>
                    )}
                </div>
            )}
        </div>
    );
};
