import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';
import { X, GripVertical, Plus, Trash2, Code, LayoutList } from 'lucide-react';

interface CreateWorkflowModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: { name: string; steps: string; confidence_thresholds: string } | null;
}

interface Step {
    id: string; // internal id for dnd
    index: number;
    agentType: string;
    systemPrompt: string;
    allowedTools: string[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const CreateWorkflowModal: React.FC<CreateWorkflowModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [mode, setMode] = useState<'visual' | 'json'>('visual');
    const [name, setName] = useState('');
    const [steps, setSteps] = useState<Step[]>([]);
    const [thresholdsJson, setThresholdsJson] = useState('{\n  "global": 90\n}');
    const [stepsJson, setStepsJson] = useState('');

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Drag and Drop state
    const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            let initialStepsArr: any[] = [];
            if (initialData) {
                setName(`Copy of ${initialData.name}`);
                setThresholdsJson(initialData.confidence_thresholds);
                setStepsJson(initialData.steps);
                try {
                    initialStepsArr = JSON.parse(initialData.steps);
                } catch (e) { }
            } else {
                setName('');
                setThresholdsJson('{\n  "global": 90\n}');
                const defaultSteps = [
                    { index: 1, agentType: "research_worker", systemPrompt: "You are a research agent.", allowedTools: ["read_email"] }
                ];
                setStepsJson(JSON.stringify(defaultSteps, null, 2));
                initialStepsArr = defaultSteps;
            }

            const internalSteps = initialStepsArr.map((s, i) => ({
                id: generateId(),
                index: s.index || i + 1,
                agentType: s.agentType || '',
                systemPrompt: s.systemPrompt || '',
                allowedTools: s.allowedTools || []
            }));

            setSteps(internalSteps);
            setError(null);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    // Sync from visual to json when switching to JSON
    const handleSwitchToJson = () => {
        const cleanSteps = steps.map((s, i) => ({
            index: i + 1,
            agentType: s.agentType,
            systemPrompt: s.systemPrompt,
            allowedTools: s.allowedTools
        }));
        setStepsJson(JSON.stringify(cleanSteps, null, 2));
        setMode('json');
    };

    // Sync from json to visual when switching to Visual
    const handleSwitchToVisual = () => {
        try {
            const parsed = JSON.parse(stepsJson);
            if (!Array.isArray(parsed)) throw new Error("Steps must be a JSON array.");
            const newSteps = parsed.map((s, i) => ({
                id: generateId(),
                index: i + 1,
                agentType: s.agentType || '',
                systemPrompt: s.systemPrompt || '',
                allowedTools: s.allowedTools || []
            }));
            setSteps(newSteps);
            setError(null);
            setMode('visual');
        } catch (err: any) {
            setError("Cannot switch to Visual Builder: " + err.message);
        }
    };

    const handleAddStep = () => {
        setSteps([...steps, {
            id: generateId(),
            index: steps.length + 1,
            agentType: '',
            systemPrompt: '',
            allowedTools: []
        }]);
    };

    const handleRemoveStep = (id: string) => {
        setSteps(steps.filter(s => s.id !== id));
    };

    const handleUpdateStep = (id: string, updates: Partial<Step>) => {
        setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const handleUpdateTools = (id: string, toolsStr: string) => {
        const tools = toolsStr.split(',').map(t => t.trim()).filter(Boolean);
        handleUpdateStep(id, { allowedTools: tools });
    };

    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedStepId(id);
        // Required for Firefox
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);

        // Make the dragged ghost slightly transparent
        setTimeout(() => {
            const target = e.target as HTMLElement;
            if (target) target.style.opacity = '0.5';
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggedStepId(null);
        setDropTargetId(null);
        const target = e.target as HTMLElement;
        if (target) target.style.opacity = '1';
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedStepId !== id) {
            setDropTargetId(id);
        }
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        setDropTargetId(null);
        if (!draggedStepId || draggedStepId === targetId) return;

        const draggedIndex = steps.findIndex(s => s.id === draggedStepId);
        const targetIndex = steps.findIndex(s => s.id === targetId);

        if (draggedIndex < 0 || targetIndex < 0) return;

        const newSteps = [...steps];
        const [removed] = newSteps.splice(draggedIndex, 1);
        newSteps.splice(targetIndex, 0, removed);

        // Re-index
        const reindexed = newSteps.map((s, i) => ({ ...s, index: i + 1 }));
        setSteps(reindexed);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            let finalSteps;
            if (mode === 'visual') {
                finalSteps = steps.map((s, i) => ({
                    index: i + 1,
                    agentType: s.agentType || 'GenericWorker',
                    systemPrompt: s.systemPrompt || '',
                    allowedTools: s.allowedTools || []
                }));
            } else {
                const parsed = JSON.parse(stepsJson);
                if (!Array.isArray(parsed)) throw new Error("Steps JSON must be an array.");
                finalSteps = parsed.map((s, i) => ({
                    ...s,
                    index: s.index || i + 1,
                    agentType: s.agentType || 'GenericWorker',
                    allowedTools: s.allowedTools || []
                }));
            }

            const thresholds = JSON.parse(thresholdsJson);

            await API.workflows.create({
                name,
                steps: finalSteps,
                confidence_thresholds: thresholds
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to parse JSON or save workflow.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pt-10 pb-10">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark w-full max-w-4xl max-h-full overflow-y-auto shadow-none">
                <div className="sticky top-0 bg-fs-surface-light dark:bg-fs-surface-dark border-b border-fs-border-light dark:border-fs-border-dark px-6 py-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold tracking-tight uppercase">{initialData ? 'Clone Workflow Template' : 'Create Custom Workflow'}</h2>

                    <div className="flex bg-fs-bg-light dark:bg-[#0A0A0B] border border-fs-border-light dark:border-[#1C1C1E] p-1">
                        <button
                            type="button"
                            onClick={handleSwitchToVisual}
                            className={`flex items-center space-x-2 px-4 py-1.5 text-xs font-bold uppercase transition-colors ${mode === 'visual' ? 'bg-fs-cyan text-black' : 'text-gray-500 hover:text-white'}`}
                        >
                            <LayoutList size={14} /> <span>Visual Builder</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSwitchToJson}
                            className={`flex items-center space-x-2 px-4 py-1.5 text-xs font-bold uppercase transition-colors ${mode === 'json' ? 'bg-fs-cyan text-black' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Code size={14} /> <span>JSON Editor</span>
                        </button>
                    </div>

                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-transparent border border-red-500 text-red-500 p-4 font-mono text-sm uppercase">
                            ERROR: {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest">Workflow Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-fs-bg-light dark:bg-fs-bg-dark border border-fs-border-light dark:border-fs-border-dark px-4 py-3 text-white font-mono focus:outline-none focus:border-fs-cyan focus:ring-1 focus:ring-fs-cyan transition-all"
                            placeholder="e.g. Acme Corp Onboarding pipeline"
                        />
                    </div>

                    {mode === 'visual' ? (
                        <div className="space-y-4">
                            <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Workflow Steps (Drag to Reorder)</label>
                            <div className="space-y-3">
                                {steps.map((step, idx) => (
                                    <div
                                        key={step.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, step.id)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => handleDragOver(e, step.id)}
                                        onDrop={(e) => handleDrop(e, step.id)}
                                        className={`flex border transition-all ${dropTargetId === step.id ? 'border-fs-cyan bg-fs-cyan/5' : 'border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-[#111113]'}`}
                                    >
                                        <div className="w-10 bg-fs-bg-light dark:bg-[#0A0A0B] border-r border-fs-border-light dark:border-fs-border-dark flex flex-col items-center py-4 cursor-grab active:cursor-grabbing text-gray-600 dark:text-gray-400 hover:text-white transition-colors">
                                            <span className="font-mono text-xs font-bold mb-2">{idx + 1}</span>
                                            <GripVertical size={16} />
                                        </div>
                                        <div className="flex-1 p-4 flex flex-col gap-4">
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Agent Type</label>
                                                    <input
                                                        type="text"
                                                        value={step.agentType}
                                                        onChange={e => handleUpdateStep(step.id, { agentType: e.target.value })}
                                                        placeholder="e.g. EmailWorker, TriageAgent"
                                                        className="w-full bg-fs-bg-light dark:bg-black border border-fs-border-light dark:border-gray-800 px-3 py-2 text-sm text-white font-mono focus:border-fs-cyan focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Allowed Tools (comma separated)</label>
                                                    <input
                                                        type="text"
                                                        value={step.allowedTools.join(', ')}
                                                        onChange={e => handleUpdateTools(step.id, e.target.value)}
                                                        placeholder="read_email, write_db, call_api"
                                                        className="w-full bg-fs-bg-light dark:bg-black border border-fs-border-light dark:border-gray-800 px-3 py-2 text-sm text-white font-mono focus:border-fs-cyan focus:outline-none"
                                                    />
                                                </div>
                                                <div className="pt-5">
                                                    <button type="button" onClick={() => handleRemoveStep(step.id)} className="h-full px-3 text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/30">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">System Prompt</label>
                                                <textarea
                                                    value={step.systemPrompt}
                                                    onChange={e => handleUpdateStep(step.id, { systemPrompt: e.target.value })}
                                                    placeholder="Instructions for this agent..."
                                                    className="w-full bg-fs-bg-light dark:bg-black border border-fs-border-light dark:border-gray-800 px-3 py-2 text-sm text-white font-mono h-16 focus:border-fs-cyan focus:outline-none"
                                                    spellCheck={false}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={handleAddStep}
                                className="w-full border border-dashed border-gray-600 text-gray-400 hover:text-fs-cyan hover:border-fs-cyan transition-colors flex items-center justify-center py-4 font-mono text-sm uppercase font-bold"
                            >
                                <Plus size={16} className="mr-2" /> Add Step
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest">Steps Definition (JSON Array)</label>
                            <textarea
                                required
                                value={stepsJson}
                                onChange={(e) => setStepsJson(e.target.value)}
                                className="w-full h-96 bg-fs-bg-light dark:bg-fs-bg-dark border border-fs-border-light dark:border-fs-border-dark px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-fs-cyan focus:ring-1 focus:ring-fs-cyan transition-all"
                                spellCheck={false}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest">Global Config / Thresholds (JSON Object)</label>
                        <textarea
                            required
                            value={thresholdsJson}
                            onChange={(e) => setThresholdsJson(e.target.value)}
                            className="w-full h-24 bg-fs-bg-light dark:bg-fs-bg-dark border border-fs-border-light dark:border-fs-border-dark px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-fs-cyan focus:ring-1 focus:ring-fs-cyan transition-all"
                            spellCheck={false}
                        />
                    </div>

                    <div className="flex justify-end pt-6 font-mono border-t border-fs-border-light dark:border-fs-border-dark">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-3 bg-transparent border border-fs-border-light dark:border-gray-700 text-gray-300 hover:bg-white/5 mr-4 transition-colors font-bold uppercase"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-3 bg-fs-cyan text-black font-bold uppercase transition-all disabled:opacity-50 hover:bg-opacity-90"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Workflow'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

