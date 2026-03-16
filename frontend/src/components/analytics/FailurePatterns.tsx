import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';

interface FailureSignature {
    cause: string;
    count: number;
}

export const FailurePatterns: React.FC = () => {
    const [patterns, setPatterns] = useState<FailureSignature[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        API.analytics.healing()
            .then((data: { topFailureSignatures?: FailureSignature[] }) => {
                setPatterns(data.topFailureSignatures ?? []);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const maxCount = patterns.length > 0 ? Math.max(...patterns.map(p => p.count), 1) : 1;

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 h-80 flex flex-col overflow-hidden">
            <h3 className="font-bold tracking-tight mb-4">Top Failure Patterns</h3>

            {isLoading ? (
                <div className="flex items-center justify-center flex-1">
                    <div className="w-6 h-6 border-2 border-fs-cyan border-t-transparent rounded-full animate-spin" />
                </div>
            ) : patterns.length === 0 ? (
                <div className="flex items-center justify-center flex-1 text-gray-500 font-mono text-xs">No failure patterns detected yet.</div>
            ) : (
                <div className="flex-1 flex flex-col space-y-3 relative">
                    {patterns.map((f, i) => {
                        const pct = Math.round((f.count / maxCount) * 100);
                        return (
                            <div key={`${f.cause}-${i}`} className="flex items-center justify-between group cursor-pointer hover:bg-fs-surface-light dark:hover:bg-black/20 p-2 -mx-2 rounded transition-colors">
                                <div className="flex items-center space-x-3 overflow-hidden pr-4">
                                    <span className="font-mono text-xs text-gray-400 bg-fs-surface-light dark:bg-black px-1.5 py-0.5">{i + 1}</span>
                                    <span className="text-sm truncate font-medium">{f.cause}</span>
                                </div>
                                <div className="flex items-center space-x-3 shrink-0">
                                    <div className="w-16 h-1.5 bg-fs-surface-light dark:bg-black">
                                        <div className="h-full bg-red-500" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="font-mono text-xs font-bold w-6 text-right">{f.count}</span>
                                </div>
                            </div>
                        );
                    })}
                    <div className="absolute bottom-0 w-full pt-4 border-t border-dashed border-fs-border-light dark:border-fs-border-dark text-center">
                        <span className="text-xs font-mono text-gray-400">LLM-analysed failure signatures</span>
                    </div>
                </div>
            )}
        </div>
    );
};
