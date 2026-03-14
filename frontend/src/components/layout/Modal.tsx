import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60" onClick={onClose} />
            <div className="relative bg-fs-bg-light dark:bg-fs-bg-dark border border-fs-border-light dark:border-fs-border-dark w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-fs-border-light dark:border-fs-border-dark bg-fs-surface-light dark:bg-fs-surface-dark flex justify-between items-center">
                    <h3 className="text-lg font-bold">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-fs-text-light dark:hover:text-fs-text-dark">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {children}
                </div>
            </div>
        </div>
    );
};
