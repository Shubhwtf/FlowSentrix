import React, { useState } from 'react';

const frameworks = ['SOC 2', 'ISO 27001', 'GDPR'];

const reportData = {
    summaryScore: 92,
    status: 'PASS',
    controls: [
        { id: 'CC6.1', desc: 'Logical access security', status: 'PASS', score: 100 },
        { id: 'CC6.6', desc: 'Boundary protection', status: 'PASS', score: 95 },
        { id: 'CC7.1', desc: 'Configuration monitoring', status: 'FAIL', score: 65 },
        { id: 'CC8.1', desc: 'Change management', status: 'PASS', score: 100 }
    ],
    gaps: [
        { desc: 'Missing explicit egress filtering on staging VPC', action: 'Apply Terraform module vpc-egress-strict', effort: 'Medium' },
        { desc: 'Admin SSH keys older than 90 days', action: 'Trigger Key Rotation workflow', effort: 'Low' }
    ]
};

export const ComplianceView: React.FC = () => {
    const [selected, setSelected] = useState(frameworks[0]);

    return (
        <div className="max-w-4xl mx-auto flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h1 className="text-2xl font-bold tracking-tight">Compliance Center</h1>
                <div className="flex space-x-3">
                    <button className="text-xs font-mono border border-fs-border-light dark:border-fs-border-dark px-4 py-1.5 transition-colors hover:bg-fs-surface-light dark:hover:bg-fs-surface-dark">Download PDF</button>
                    <button className="text-xs font-mono bg-fs-cyan text-black px-4 py-1.5 font-bold hover:bg-opacity-90 transition-opacity">Generate New Report</button>
                </div>
            </div>

            <div className="flex space-x-6 border-b border-fs-border-light dark:border-fs-border-dark mb-6 shrink-0">
                {frameworks.map(fw => (
                    <button
                        key={fw}
                        onClick={() => setSelected(fw)}
                        className={`pb-3 text-sm font-medium transition-colors border-b-2 ${selected === fw ? 'border-fs-cyan text-fs-text-light dark:text-fs-text-dark' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                    >
                        {fw}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
                <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 flex justify-between items-center">
                    <div>
                        <h3 className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-1">Executive Summary</h3>
                        <p className="text-lg font-bold">{selected} Readiness Assessment</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="font-mono text-4xl font-bold text-green-500">{reportData.summaryScore}%</span>
                        <div className="w-12 h-12 rounded-full border-4 border-green-500 flex items-center justify-center font-mono text-xs font-bold text-green-500">PASS</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6">
                        <h3 className="font-bold tracking-tight mb-4 uppercase text-xs text-gray-500">Control Areas</h3>
                        <div className="space-y-3">
                            {reportData.controls.map(c => (
                                <div key={c.id} className="flex justify-between items-center text-sm font-mono border-b border-fs-border-light dark:border-fs-border-dark pb-2 last:border-0">
                                    <div className="flex space-x-3">
                                        <span className="font-bold">{c.id}</span>
                                        <span className="text-gray-500 truncate w-40" title={c.desc}>{c.desc}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider bg-black/5 dark:bg-white/5 ${c.status === 'PASS' ? 'text-green-500' : 'text-red-500'}`}>{c.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6">
                        <h3 className="font-bold tracking-tight mb-4 uppercase text-xs text-gray-500">Actionable Gaps</h3>
                        <div className="space-y-4">
                            {reportData.gaps.map((g, i) => (
                                <div key={i} className="flex flex-col space-y-1">
                                    <span className="text-sm font-medium">{g.desc}</span>
                                    <div className="flex justify-between items-end font-mono text-[10px] text-gray-500 uppercase">
                                        <span>Action: {g.action}</span>
                                        <span className={g.effort === 'Low' ? 'text-green-500' : 'text-amber-500'}>Effort: {g.effort}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
