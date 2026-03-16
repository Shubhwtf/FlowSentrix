import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';

export const CodeReviewList: React.FC = () => {
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Fetch runs that are code reviews
        API.runs.list()
            .then(runs => {
                const reviewRuns = runs.filter(r => r.workflow_id === 'pr_review_pipeline' || r.workflow_id?.includes('review'));
                setReviews(reviewRuns);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const getStatusColor = (v: string) => {
        switch (v) {
            case 'SUCCEEDED': return 'text-green-500';
            case 'RUNNING': return 'text-amber-500';
            case 'FAILED': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark flex flex-col h-[500px]">
            <div className="p-4 border-b border-fs-border-light dark:border-fs-border-dark flex justify-between items-center bg-fs-surface-light dark:bg-fs-bg-dark">
                <h3 className="font-bold tracking-tight text-sm uppercase text-gray-500">Recent Code Review Runs</h3>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-fs-border-light dark:divide-fs-border-dark">
                {isLoading ? (
                    <div className="p-4 text-center text-xs font-mono text-gray-500">Loading reviews...</div>
                ) : reviews.length === 0 ? (
                    <div className="p-4 text-center text-xs font-mono text-gray-500">No code review runs found. Trigger one to see it here.</div>
                ) : (
                    reviews.map((r) => (
                        <div key={r.id} className="p-4 hover:bg-fs-surface-light dark:hover:bg-black/20 transition-colors cursor-pointer group">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-sm tracking-tight truncate font-mono">Run: {r.id.split('-')[0]}</h4>
                                <span className={`font-mono text-[10px] uppercase font-bold tracking-wider ${getStatusColor(r.status)}`}>
                                    {r.status}
                                </span>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="font-mono text-xs text-gray-500">{new Date(r.started_at).toLocaleString()}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
