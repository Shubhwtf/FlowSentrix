import React, { useState } from 'react';

// Generates 30 days of mock run data
const mockData = Array.from({ length: 30 }).map((_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    total: Math.floor(Math.random() * 50) + 10,
    failed: Math.floor(Math.random() * 5)
}));

export const RunVolumeChart: React.FC = () => {
    const [hoveredData, setHoveredData] = useState<typeof mockData[0] | null>(null);
    const maxVal = Math.max(...mockData.map(d => d.total));

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 flex flex-col h-80">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold tracking-tight">Run Volume (30d)</h3>
                <select className="bg-transparent text-xs font-mono border-b border-fs-border-light dark:border-fs-border-dark outline-none cursor-pointer pb-1">
                    <option>Last 30 Days</option>
                    <option>Last 7 Days</option>
                </select>
            </div>

            <div className="flex-1 relative flex items-end justify-between px-2 pb-6">
                {mockData.map((d, i) => {
                    const heightPct = (d.total / maxVal) * 100;
                    return (
                        <div
                            key={i}
                            className="w-2 md:w-3 bg-fs-cyan transition-all duration-300 relative group cursor-crosshair"
                            style={{ height: `${heightPct}%` }}
                            onMouseEnter={() => setHoveredData(d)}
                            onMouseLeave={() => setHoveredData(null)}
                        >
                            <div className="absolute top-0 left-0 w-full bg-red-500" style={{ height: `${(d.failed / d.total) * 100}%` }}></div>
                        </div>
                    );
                })}
            </div>

            {hoveredData ? (
                <div className="h-6 flex items-center justify-between text-xs font-mono border-t border-fs-border-light dark:border-fs-border-dark pt-3">
                    <span className="text-gray-500">{hoveredData.date}</span>
                    <div className="flex space-x-4">
                        <span>TOTAL: {hoveredData.total}</span>
                        <span className="text-red-500">FAIL: {hoveredData.failed}</span>
                    </div>
                </div>
            ) : (
                <div className="h-6 flex justify-between items-center text-[10px] font-mono text-gray-400 border-t border-fs-border-light dark:border-fs-border-dark pt-3">
                    <span>{mockData[0].date}</span>
                    <span>Hover bars for detail</span>
                    <span>{mockData[mockData.length - 1].date}</span>
                </div>
            )}
        </div>
    );
};
