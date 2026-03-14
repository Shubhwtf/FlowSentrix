import React from 'react';
import { RunVolumeChart } from './RunVolumeChart';
import { ConfidenceHistogram } from './ConfidenceHistogram';
import { HealingDonut } from './HealingDonut';
import { FailurePatterns } from './FailurePatterns';

export const AnalyticsView: React.FC = () => {
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-2xl font-bold tracking-tight">System Analytics</h1>
                <button className="text-xs font-mono uppercase bg-fs-cyan text-black px-4 py-1.5 font-bold">Export CSV</button>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <RunVolumeChart />
                <ConfidenceHistogram />
                <HealingDonut />
                <FailurePatterns />
            </div>
        </div>
    );
};
