import React from 'react';
import { WorkflowBuilder } from './WorkflowBuilder';

interface CreateWorkflowModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: { name: string; steps: string; confidence_thresholds: string } | null;
}

export const CreateWorkflowModal: React.FC<CreateWorkflowModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    return <WorkflowBuilder isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} initialData={initialData} />;
};

