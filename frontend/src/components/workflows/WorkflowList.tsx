import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../../api/client';
import type { WorkflowDefinition } from '../../api/types';
import { CreateWorkflowModal } from './CreateWorkflowModal';

export const WorkflowList: React.FC = () => {
    const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [cloneData, setCloneData] = useState<{ name: string; steps: string; confidence_thresholds: string } | null>(null);

    const loadWorkflows = useCallback(() => {
        API.workflows.list().then(setWorkflows).catch(console.error);
    }, []);

    useEffect(() => {
        loadWorkflows();
    }, [loadWorkflows]);

    const handleClone = (e: React.MouseEvent, wf: WorkflowDefinition) => {
        e.stopPropagation();
        setCloneData({
            name: wf.name,
            steps: JSON.stringify(wf.steps, null, 2),
            confidence_thresholds: JSON.stringify(wf.confidence_thresholds || {}, null, 2)
        });
        setIsCreateModalOpen(true);
    };

    const handleCreateNew = () => {
        setCloneData(null);
        setIsCreateModalOpen(true);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Workflow Definitions</h1>
                    <span className="font-mono text-xs px-3 py-1 bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark inline-block mt-2">{workflows.length} REGISTERED</span>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="bg-fs-cyan text-black px-6 py-2 font-mono font-bold hover:bg-[#00E5FF] transition-colors"
                >
                    + CREATE WORKFLOW
                </button>
            </div>

            {workflows.map(wf => (
                <div key={wf.id} className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark transition-all">
                    <div
                        className="p-6 flex items-center justify-between cursor-pointer hover:bg-fs-surface-light dark:hover:bg-black/20"
                        onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)}
                    >
                        <div>
                            <h2 className="text-xl font-bold tracking-tight mb-1">{wf.name}</h2>
                            <div className="flex space-x-4 text-xs font-mono text-gray-500 uppercase">
                                <span>{wf.steps.length} STEPS</span>
                                <span>•</span>
                                <span>TH {wf.confidence_thresholds?.global ?? 90}%</span>
                                <span>•</span>
                                <span>{Object.keys(wf.integration_mappings || {}).length} INTEGRATIONS</span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-6 text-right">
                            <div>
                                <span className="block text-xs font-mono text-gray-500 uppercase mb-1">HEALTH SCORE</span>
                                <span className="font-mono font-bold text-lg text-green-500">98.4%</span>
                            </div>

                            <button className="text-gray-400 hover:text-white font-mono text-xs uppercase px-4 py-2 border border-fs-border-light dark:border-fs-border-dark" onClick={(e) => handleClone(e, wf)}>
                                CLONE
                            </button>

                            <button className="bg-fs-surface-light dark:bg-gray-800 text-white px-6 py-2 font-medium hover:bg-gray-700 transition border border-fs-border-dark" onClick={(e) => { e.stopPropagation(); /* Optional trigger run from here */ }}>
                                TRIGGER RUN
                            </button>
                        </div>
                    </div>

                    {expandedId === wf.id && (
                        <div className="border-t border-dashed border-fs-border-light dark:border-fs-border-dark p-6 bg-fs-bg-light dark:bg-fs-bg-dark">
                            <StepFlowDiagram steps={wf.steps} thresholds={wf.confidence_thresholds || { global: 90 }} />
                        </div>
                    )}
                </div>
            ))}

            <CreateWorkflowModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={loadWorkflows}
                initialData={cloneData}
            />
        </div>
    );
};

const StepFlowDiagram: React.FC<{ steps: any[], thresholds: any }> = ({ steps, thresholds }) => {
    return (
        <div className="flex flex-col space-y-8 pt-4">
            <h3 className="font-mono text-xs uppercase text-gray-500 tracking-wider">Agent Pipeline Execution Topology</h3>

            <div className="flex items-start overflow-x-auto pb-4 pt-2 hide-scrollbar space-x-8">
                {steps.map((step, idx) => (
                    <div key={idx} className="flex items-center shrink-0">
                        <div className="w-56 bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-4 relative shadow-sm">
                            <div className="absolute -top-3 left-4 bg-fs-cyan text-black font-mono text-[10px] uppercase font-bold px-2 py-0.5 shadow">
                                STEP {String(idx + 1).padStart(2, '0')}
                            </div>

                            <h4 className="font-bold uppercase tracking-tight mt-2 mb-2">{step.agentType?.replace(/Worker/i, '') || step.agentType || 'UNKNOWN'}</h4>

                            <div className="space-y-1 font-mono text-[10px] text-gray-500 group">
                                <div className="flex justify-between w-full">
                                    <span>CONF THRESHOLD</span>
                                    <span className="text-fs-text-light dark:text-fs-text-dark">{thresholds?.steps?.[String(idx)] || thresholds?.global || 90}%</span>
                                </div>
                                <div className="flex justify-between w-full">
                                    <span>TOOLS GRANTED</span>
                                    <span className="text-fs-text-light dark:text-fs-text-dark">{step.allowedTools?.length || 0}</span>
                                </div>
                            </div>
                        </div>

                        {idx < steps.length - 1 && (
                            <div className="w-8 flex items-center justify-center shrink-0 text-gray-300 dark:text-gray-700">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
