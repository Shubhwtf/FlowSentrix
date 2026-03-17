import React, { useEffect, useState } from 'react';
import { API } from '../../api/client';
import type { WorkflowDefinition } from '../../api/types';

interface WorkflowSelectorProps {
    onSelect: (id: string) => void;
    selectedId: string | null;
}

export const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({ onSelect, selectedId }) => {
    const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);

    useEffect(() => {
        API.workflows.list().then(data => {
            setWorkflows(data);
        }).catch(console.error);
    }, []);

    return (
        <div className="flex space-x-6 border-b border-border mb-6">
            <button
                onClick={() => onSelect('')}
                className={`pb-3 text-sm font-medium transition-colors duration-80 border-b-2 ${!selectedId ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
                All Workflows
            </button>
            {workflows.map(wf => (
                <button
                    key={wf.id}
                    onClick={() => onSelect(wf.id)}
                    className={`pb-3 text-sm font-medium transition-colors duration-80 border-b-2 flex items-center space-x-2 ${selectedId === wf.id ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                >
                    <span>{wf.name}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-text-primary"></div>
                </button>
            ))}
        </div>
    );
};
