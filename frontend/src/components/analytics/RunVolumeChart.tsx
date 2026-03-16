import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';

interface RunDataPoint {
    date: string;
    total: number;
    succeeded: number;
    failed: number;
    healed: number;
}

export const RunVolumeChart: React.FC = () => {
    const [data, setData] = useState<RunDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hoveredData, setHoveredData] = useState<RunDataPoint | null>(null);

    useEffect(() => {
        API.analytics.runsByPeriod('month')
            .then((d) => setData(d as RunDataPoint[]))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const maxVal = data.length > 0 ? Math.max(...data.map(d => d.total), 1) : 1;

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 flex flex-col h-80">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold tracking-tight">Run Volume (30d)</h3>
                <span className="text-xs font-mono text-gray-400">LIVE DATA</span>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center flex-1">
                    <div className="w-6 h-6 border-2 border-fs-cyan border-t-transparent rounded-full animate-spin" />
                </div>
            ) : data.length === 0 ? (
                <div className="flex items-center justify-center flex-1 text-gray-500 font-mono text-xs">No run data yet. Trigger a workflow run to see charts.</div>
            ) : (
                <>
                    <div className="flex-1 relative flex items-end justify-between px-2 pb-6">
                        {data.map((d, i) => {
                            const heightPct = (d.total / maxVal) * 100;
                            return (
                                <div
                                    key={i}
                                    className="w-2 md:w-3 bg-fs-cyan transition-all duration-300 relative group cursor-crosshair"
                                    style={{ height: `${heightPct}%` }}
                                    onMouseEnter={() => setHoveredData(d)}
                                    onMouseLeave={() => setHoveredData(null)}
                                >
                                    <div className="absolute top-0 left-0 w-full bg-red-500" style={{ height: `${d.total > 0 ? (d.failed / d.total) * 100 : 0}%` }} />
                                </div>
                            );
                        })}
                    </div>

                    {hoveredData ? (
                        <div className="h-6 flex items-center justify-between text-xs font-mono border-t border-fs-border-light dark:border-fs-border-dark pt-3">
                            <span className="text-gray-500">{hoveredData.date}</span>
                            <div className="flex space-x-4">
                                <span>TOTAL: {hoveredData.total}</span>
                                <span className="text-green-500">OK: {hoveredData.succeeded}</span>
                                <span className="text-red-500">FAIL: {hoveredData.failed}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="h-6 flex justify-between items-center text-[10px] font-mono text-gray-400 border-t border-fs-border-light dark:border-fs-border-dark pt-3">
                            <span>{data[0]?.date}</span>
                            <span>Hover bars for detail</span>
                            <span>{data[data.length - 1]?.date}</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
