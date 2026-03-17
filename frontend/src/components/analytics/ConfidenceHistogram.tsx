import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';

export const ConfidenceHistogram: React.FC = () => {
    const [buckets, setBuckets] = useState<Array<{ bucket: string; count: number }>>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        API.analytics.confidence()
            .then((data) => setBuckets(data))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const maxCount = buckets.length > 0 ? Math.max(...buckets.map(b => b.count), 1) : 1;

    const getColor = (index: number) => {
        if (index < 3) return '#ef4444';
        if (index < 6) return '#f59e0b';
        if (index < 8) return '#22d3ee';
        return 'var(--text-primary)';
    };

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 flex flex-col h-80">
            <h3 className="font-bold tracking-tight mb-4">Confidence Distribution</h3>

            {isLoading ? (
                <div className="flex items-center justify-center flex-1">
                    <div className="w-6 h-6 border-2 border-fs-cyan border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-between overflow-y-hidden">
                    {[...buckets].reverse().map((bucket, i) => {
                        const widthPct = (bucket.count / maxCount) * 100;
                        const trueIndex = buckets.length - 1 - i;
                        return (
                            <div key={bucket.bucket} className="flex items-center space-x-3 text-[10px] font-mono h-4">
                                <span className="w-12 text-right text-gray-500">{bucket.bucket}</span>
                                <div className="flex-1 bg-fs-surface-light dark:bg-black relative h-1.5 flex items-center">
                                    <div
                                        className="absolute left-0 h-full transition-all duration-500"
                                        style={{ width: `${widthPct}%`, backgroundColor: getColor(trueIndex) }}
                                    />
                                </div>
                                <span className="w-8">{bucket.count}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
