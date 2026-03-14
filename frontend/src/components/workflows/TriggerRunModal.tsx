import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';
import type { WorkflowDefinition } from '../../api/types';
import { Modal } from '../layout/Modal';

interface NewRunModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRunCreated?: (runId: string) => void;
}

export const NewRunModal: React.FC<NewRunModalProps> = ({ isOpen, onClose, onRunCreated }) => {
    const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
    const [selectedWf, setSelectedWf] = useState<string>('');
    const [payload, setPayload] = useState('{\n  \n}');
    const [demoMode, setDemoMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            API.workflows.list().then(data => {
                setWorkflows(data);
                if (data.length > 0 && !selectedWf) {
                    setSelectedWf(data[0].id);
                }
            }).catch(console.error);
        }
    }, [isOpen]);

    useEffect(() => {
        if (demoMode) {
            setPayload(JSON.stringify({ DEMO_INJECT_FAILURE_AT_STEP: 4 }, null, 2));
        } else {
            setPayload('{\n  \n}');
        }
    }, [demoMode]);

    const handleSubmit = async () => {
        if (!selectedWf) return;
        try {
            setIsSubmitting(true);
            const data = JSON.parse(payload);
            const res = await API.workflows.run(selectedWf, data);
            onRunCreated?.(res.runId);
            onClose();
        } catch (err) {
            alert("Invalid JSON or execution failed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Execute New Run">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Workflow</label>
                    <select
                        value={selectedWf}
                        onChange={(e) => setSelectedWf(e.target.value)}
                        className="w-full bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark px-3 py-2 outline-none focus:border-fs-cyan transition-colors"
                    >
                        {workflows.map(wf => (
                            <option key={wf.id} value={wf.id}>{wf.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium">Initial Payload (JSON)</label>
                        <label className="flex items-center space-x-2 text-sm">
                            <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} className="accent-fs-cyan" />
                            <span>Demo Mode (Inject Failure)</span>
                        </label>
                    </div>
                    <textarea
                        value={payload}
                        onChange={(e) => setPayload(e.target.value)}
                        className="w-full h-40 bg-fs-surface-light dark:bg-fs-bg-dark border border-fs-border-light dark:border-fs-border-dark px-3 py-2 font-mono text-sm outline-none focus:border-fs-cyan transition-colors"
                        spellCheck={false}
                    />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 hover:bg-fs-surface-light dark:hover:bg-fs-surface-dark transition-colors">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-fs-cyan text-black font-medium hover:bg-opacity-90 disabled:opacity-50 transition-opacity"
                    >
                        {isSubmitting ? 'Starting...' : 'Execute'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
