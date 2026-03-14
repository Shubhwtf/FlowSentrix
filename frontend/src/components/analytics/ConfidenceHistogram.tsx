import React from 'react';

// Random distribution biased towards high confidence
const buckets = [
    { range: '0-10', count: 2 },
    { range: '10-20', count: 3 },
    { range: '20-30', count: 5 },
    { range: '30-40', count: 8 },
    { range: '40-50', count: 12 },
    { range: '50-60', count: 15 },
    { range: '60-70', count: 30 },
    { range: '70-80', count: 85 },
    { range: '80-90', count: 210 },
    { range: '90-100', count: 540 },
];

export const ConfidenceHistogram: React.FC = () => {
    const maxCount = Math.max(...buckets.map(b => b.count));

    const getColor = (index: number, total: number) => {
        // Gradient from red (bad) to cyan (good)
        if (index < 3) return '#ef4444'; // red-500
        if (index < 6) return '#f59e0b'; // amber-500
        if (index < 8) return '#22d3ee'; // cyan-400
        return '#00D4FF'; // fs-cyan
    };

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 flex flex-col h-80">
            <h3 className="font-bold tracking-tight mb-4">Confidence Distribution</h3>

            <div className="flex-1 flex flex-col justify-between overflow-y-hidden">
                {[...buckets].reverse().map((bucket, i) => {
                    const widthPct = (bucket.count / maxCount) * 100;
                    const trueIndex = buckets.length - 1 - i;

                    return (
                        <div key={bucket.range} className="flex items-center space-x-3 text-[10px] font-mono h-4">
                            <span className="w-12 text-right text-gray-500">{bucket.range}</span>
                            <div className="flex-1 bg-fs-surface-light dark:bg-black relative h-1.5 flex items-center">
                                <div
                                    className="absolute left-0 h-full transition-all duration-500"
                                    style={{
                                        width: `${widthPct}%`,
                                        backgroundColor: getColor(trueIndex, buckets.length)
                                    }}
                                />
                            </div>
                            <span className="w-8">{bucket.count}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
