import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';

interface HealingData {
    total: number;
    resolved: number;
    escalated: number;
    rollbackFrequency: number;
}

export const HealingDonut: React.FC = () => {
    const [data, setData] = useState<HealingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        API.analytics.healing()
            .then((d) => {
                if (typeof d === 'object' && d !== null) {
                    const total = typeof d.total === 'number' ? d.total : 0;
                    const resolved = typeof d.resolved === 'number' ? d.resolved : 0;
                    const escalated = typeof d.escalated === 'number' ? d.escalated : 0;
                    const rollbackFrequency = typeof d.rollbackFrequency === 'number' ? d.rollbackFrequency : 0;
                    setData({ total, resolved, escalated, rollbackFrequency });
                } else {
                    setData({ total: 0, resolved: 0, escalated: 0, rollbackFrequency: 0 });
                }
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const segments = data ? [
        { label: 'RESOLVED', value: data.resolved, color: 'var(--text-primary)' },
        { label: 'ESCALATED', value: data.escalated, color: '#f59e0b' },
        { label: 'ROLLBACK', value: data.rollbackFrequency, color: '#f97316' },
    ].filter(s => s.value > 0) : [];

    const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
    let currentAngle = 0;

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 h-80 relative flex flex-col">
            <h3 className="font-bold tracking-tight mb-2">Healing Breakdown</h3>

            {isLoading ? (
                <div className="flex items-center justify-center flex-1">
                    <div className="w-6 h-6 border-2 border-fs-cyan border-t-transparent rounded-full animate-spin" />
                </div>
            ) : !data || data.total === 0 ? (
                <div className="flex items-center justify-center flex-1 text-gray-500 font-mono text-xs text-center">No healing events yet.</div>
            ) : (
                <>
                    <div className="flex-1 flex items-center justify-center relative">
                        <svg viewBox="-100 -100 200 200" className="w-40 h-40 transform -rotate-90">
                            {segments.map(segment => {
                                const percent = segment.value / total;
                                const dashArray = `${percent * 2 * Math.PI * 80} ${2 * Math.PI * 80}`;
                                const offset = (currentAngle / 360) * 2 * Math.PI * 80;
                                const circle = (
                                    <circle
                                        key={segment.label}
                                        r="80" cx="0" cy="0"
                                        fill="transparent"
                                        stroke={segment.color}
                                        strokeWidth="20"
                                        strokeDasharray={dashArray}
                                        strokeDashoffset={-offset}
                                        className="transition-all duration-500 hover:stroke-[25] cursor-crosshair"
                                    >
                                        <title>{segment.label}: {segment.value}</title>
                                    </circle>
                                );
                                currentAngle += percent * 360;
                                return circle;
                            })}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="font-mono text-3xl font-bold">{data.total}</span>
                            <span className="text-[10px] font-mono text-gray-500 uppercase">Total Events</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center mt-6 gap-4 text-[10px] font-mono uppercase">
                        {segments.map(s => (
                            <div key={s.label} className="flex items-center space-x-1.5 border border-fs-border-light dark:border-fs-border-dark px-2 py-1 rounded-full">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                <span className="text-gray-500">{s.label} ({s.value})</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
