import React from 'react';
import { VulnerabilitiesTable } from './VulnerabilitiesTable';
import { CodeReviewList } from './CodeReviewList';

export const SecurityView: React.FC = () => {
    return (
        <div className="max-w-7xl mx-auto space-y-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-2 shrink-0">
                <h1 className="text-2xl font-bold tracking-tight">Security & Governance</h1>
            </div>

            <div className="grid grid-cols-[2fr_1fr] gap-6 flex-1 min-h-0">
                <VulnerabilitiesTable />
                <CodeReviewList />
            </div>
        </div>
    );
};
