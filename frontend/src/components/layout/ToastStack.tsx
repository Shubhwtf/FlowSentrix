import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}

const borderColors = {
    info: 'border-fs-cyan',
    success: 'border-green-500',
    warning: 'border-amber-500',
    error: 'border-red-500'
};

export const useToast = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (type: ToastType, message: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => {
            const next = [{ id, type, message }, ...prev];
            if (next.length > 4) return next.slice(0, 4);
            return next;
        });

        setTimeout(() => removeToast(id), 4000);
    };

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return { toasts, addToast, removeToast };
};

export const ToastStack: React.FC<{ toasts: ToastMessage[], onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => {
    return (
        <div className="fixed top-20 right-6 z-50 flex flex-col gap-3">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={() => onDismiss(toast.id)}
                        className={`w-80 bg-white dark:bg-fs-surface-dark border-l-4 ${borderColors[toast.type]} shadow-lg px-4 py-3 cursor-pointer relative overflow-hidden`}
                    >
                        <span className="text-sm font-medium text-fs-text-light dark:text-fs-text-dark">{toast.message}</span>
                        <motion.div
                            initial={{ width: '100%' }}
                            animate={{ width: 0 }}
                            transition={{ duration: 4, ease: "linear" }}
                            className={`absolute bottom-0 left-0 h-0.5 ${borderColors[toast.type].replace('border-', 'bg-')}`}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
