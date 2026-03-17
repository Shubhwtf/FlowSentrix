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
                    className="fixed inset-0 bg-transparent z-40"
                    onClick={onClose}
                />
            )}
            <div
                className={`fixed top-0 right-0 h-full w-[480px] bg-surface border-l border-border z-50 transform transition-transform duration-180 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="h-12 flex items-center justify-between px-4 border-b border-border">
                    <h2 className="text-sm font-semibold tracking-tight">Details</h2>
                    <button
                        onClick={onClose}
                        className="h-7 w-7 inline-flex items-center justify-center border border-border text-text-secondary hover:text-text-primary"
                    >
                        <X size={16} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>
            </div>
        </>
    );
};
