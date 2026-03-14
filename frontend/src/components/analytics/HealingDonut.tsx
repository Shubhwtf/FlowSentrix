import React from 'react';

const segments = [
    { label: 'PROACTIVE', value: 145, color: '#00D4FF' }, // fs-cyan
    { label: 'REACTIVE', value: 32, color: '#f59e0b' }, // amber-500
    { label: 'ROLLBACK', value: 12, color: '#f97316' }, // orange-500
    { label: 'HITL', value: 8, color: '#ef4444' }  // red-500
];

export const HealingDonut: React.FC = () => {
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    let currentAngle = -90; // Start at 12 o'clock

    const getCoordinatesForPercent = (percent: number, radius: number) => {
        const x = Math.cos(2 * Math.PI * percent) * radius;
        const y = Math.sin(2 * Math.PI * percent) * radius;
        return [x, y];
    };

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 h-80 relative flex flex-col">
            <h3 className="font-bold tracking-tight mb-2">Healing Breakdown</h3>

            <div className="flex-1 flex items-center justify-center relative">
                <svg viewBox="-100 -100 200 200" className="w-40 h-40 transform -rotate-90">
                    {segments.map((segment) => {
                        const percent = segment.value / total;
                        const dashArray = `${percent * 2 * Math.PI * 80} ${2 * Math.PI * 80}`;
                        const offset = (currentAngle / 360) * 2 * Math.PI * 80;

                        const circle = (
                            <circle
                                key={segment.label}
                                r="80"
                                cx="0"
                                cy="0"
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
                    <span className="font-mono text-3xl font-bold">{total}</span>
                    <span className="text-[10px] font-mono text-gray-500 uppercase">Total Events</span>
                </div>
            </div>

            <div className="flex flex-wrap justify-center mt-6 gap-4 text-[10px] font-mono uppercase">
                {segments.map(s => (
                    <div key={s.label} className="flex items-center space-x-1.5 border border-fs-border-light dark:border-fs-border-dark px-2 py-1 rounded-full">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                        <span className="text-gray-500">{s.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
