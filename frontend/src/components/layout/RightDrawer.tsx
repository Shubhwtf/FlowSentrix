import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface RightDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export const RightDrawer: React.FC<RightDrawerProps> = ({ isOpen, onClose, children }) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen && !children) return null;

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 transition-opacity"
                    onClick={onClose}
                />
            )}
            <div
                className={`fixed top-0 right-0 h-full w-[480px] bg-white dark:bg-fs-bg-dark border-l border-fs-border-light dark:border-fs-border-dark z-50 transform transition-transform duration-200 ease-out shadow-2xl flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-fs-border-light dark:border-fs-border-dark bg-fs-surface-light dark:bg-fs-surface-dark">
                    <h2 className="text-lg font-semibold tracking-tight">Details</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-fs-text-light dark:hover:text-fs-text-dark transition-colors p-1"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>
            </div>
        </>
    );
};
