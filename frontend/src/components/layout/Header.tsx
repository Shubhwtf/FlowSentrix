import React, { useState } from 'react';
import { Sun, Moon, Bell } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { NewRunModal } from '../workflows/TriggerRunModal';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const [modalOpen, setModalOpen] = useState(false);
    const navigate = useNavigate();

    const handleRunCreated = (runId: string) => {
        navigate(`/?run=${runId}`);
    };

    return (
        <header className="sticky top-0 z-50 h-14 w-full bg-fs-bg-light dark:bg-fs-bg-dark border-b border-fs-border-light dark:border-fs-border-dark flex items-center justify-between px-6">
            <div className="flex items-center space-x-3">
                <span className="font-bold text-lg tracking-tight">FlowSentrix</span>
                <span className="font-mono text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-sm uppercase">Aria 2025</span>
            </div>

            <div className="flex items-center space-x-2 absolute left-1/2 transform -translate-x-1/2">
                <div className="w-2 h-2 rounded-full bg-fs-cyan animate-pulse"></div>
                <span className="font-mono text-sm">System active</span>
            </div>

            <div className="flex items-center space-x-4">
                <button onClick={toggleTheme} className="text-gray-500 hover:text-fs-text-light dark:hover:text-fs-text-dark transition-colors">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button className="relative text-gray-500 hover:text-fs-text-light dark:hover:text-fs-text-dark transition-colors">
                    <Bell size={18} />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fs-cyan opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-fs-cyan"></span>
                    </span>
                </button>
                <button
                    onClick={() => setModalOpen(true)}
                    className="bg-fs-cyan text-black px-4 py-1.5 font-medium text-sm hover:bg-opacity-90 transition-opacity"
                >
                    New Run
                </button>
            </div>

            <NewRunModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onRunCreated={handleRunCreated} />
        </header>
    );
};
