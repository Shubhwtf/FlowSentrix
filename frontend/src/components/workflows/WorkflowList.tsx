import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../../api/client';
import type { WorkflowDefinition } from '../../api/types';
import { CreateWorkflowModal } from './CreateWorkflowModal';

export const WorkflowList: React.FC = () => {
    const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [cloneData, setCloneData] = useState<{ name: string; steps: string; confidence_thresholds: string } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const handleDelete = async (e: React.MouseEvent, wf: WorkflowDefinition) => {
        e.stopPropagation();
        const confirmed = window.confirm(`Delete workflow "${wf.name}"? This cannot be undone.`);
        if (!confirmed) return;
        setDeletingId(wf.id);
        try {
            const apiKey = window.localStorage.getItem('API_KEY') || '';
            await API.workflows.delete(wf.id, apiKey || undefined);
            await loadWorkflows();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to delete workflow');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-[20px] md:text-2xl font-bold tracking-tight">Workflow Definitions</h1>
                        <span data-badge className="bg-surface-elevated border border-border">
                            {workflows.length} REGISTERED
                        </span>
                    </div>
                    <p className="text-sm text-text-secondary max-w-2xl">
                        Build and manage agent pipelines. Clone proven templates, tune confidence thresholds, then trigger runs to see live execution + healing.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCreateNew}
                        className="px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity"
                    >
                        + Create Workflow
                    </button>
                </div>
            </div>

            {workflows.length === 0 ? (
                <div className="bg-surface border border-border rounded-md p-10 md:p-14 text-center">
                    <div className="max-w-xl mx-auto space-y-3">
                        <div className="font-mono text-xs uppercase tracking-widest text-text-muted">No workflows yet</div>
                        <div className="text-xl md:text-2xl font-bold tracking-tight">Create your first pipeline</div>
                        <p className="text-sm text-text-secondary">
                            Start with a clean template, paste JSON directly, or clone a known-good workflow for your demo.
                        </p>
                        <div className="pt-2">
                            <button
                                onClick={handleCreateNew}
                                className="px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity"
                            >
                                + Create Workflow
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {workflows.map(wf => (
                        <div key={wf.id} className="bg-surface border border-border rounded-md overflow-hidden">
                            <div
                                className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between cursor-pointer hover:bg-surface-elevated transition-colors"
                                onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)}
                            >
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold tracking-tight mb-1 truncate">{wf.name}</h2>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-mono text-text-secondary uppercase">
                                        <span>{wf.steps.length} Steps</span>
                                        <span className="text-border">•</span>
                                        <span>TH {wf.confidence_thresholds?.global ?? 90}%</span>
                                        <span className="text-border">•</span>
                                        <span>{Object.keys(wf.integration_mappings || {}).length} Integrations</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-3">
                                    <div className="hidden md:block text-right">
                                        <span className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">Health Score</span>
                                        <span className="font-mono font-bold text-lg text-success">98.4%</span>
                                    </div>

                                    <button
                                        className="px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest border border-border text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                                        onClick={(e) => handleClone(e, wf)}
                                    >
                                        Clone
                                    </button>

                                    <button
                                        className="px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest border border-border text-destructive hover:bg-surface-elevated disabled:opacity-50 transition-colors"
                                        disabled={deletingId === wf.id}
                                        onClick={(e) => handleDelete(e, wf)}
                                    >
                                        {deletingId === wf.id ? 'Deleting…' : 'Delete'}
                                    </button>

                                    <button
                                        className="px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); }}
                                    >
                                        Trigger Run
                                    </button>
                                </div>
                            </div>

                            {expandedId === wf.id && (
                                <div className="border-t border-border p-6 bg-background">
                                    <StepFlowDiagram steps={wf.steps} thresholds={wf.confidence_thresholds || { global: 90 }} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

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
            <h3 className="font-mono text-xs uppercase text-text-secondary tracking-wider">Agent Pipeline Execution Topology</h3>

            <div className="flex items-start overflow-x-auto pb-4 pt-2 hide-scrollbar space-x-8">
                {steps.map((step, idx) => (
                    <div key={idx} className="flex items-center shrink-0">
                        <div className="w-56 bg-surface border border-border p-4 relative rounded-md">
                            <div className="absolute -top-3 left-4 bg-accent text-accent-foreground font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm">
                                STEP {String(idx + 1).padStart(2, '0')}
                            </div>

                            <h4 className="font-bold uppercase tracking-tight mt-2 mb-2">{step.agentType?.replace(/Worker/i, '') || step.agentType || 'UNKNOWN'}</h4>

                            <div className="space-y-1 font-mono text-[10px] text-text-secondary group">
                                <div className="flex justify-between w-full">
                                    <span>CONF THRESHOLD</span>
                                    <span className="text-text-primary">{thresholds?.steps?.[String(idx)] || thresholds?.global || 90}%</span>
                                </div>
                                <div className="flex justify-between w-full">
                                    <span>TOOLS GRANTED</span>
                                    <span className="text-text-primary">{step.allowedTools?.length || 0}</span>
                                </div>
                            </div>
                        </div>

                        {idx < steps.length - 1 && (
                            <div className="w-8 flex items-center justify-center shrink-0 text-border">
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
