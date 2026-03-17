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
        <header className="sticky top-0 z-50 h-12 w-full bg-background border-b border-border flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold tracking-tight">FlowSentrix</span>
                <span className="text-text-muted">/</span>
                <span className="font-mono text-[11px] text-text-secondary uppercase">ARIA 2025</span>
            </div>

            <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
                <div className="h-1.5 w-1.5 rounded-full bg-text-primary"></div>
                <span className="font-mono text-xs text-text-primary">SYSTEM ACTIVE</span>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={toggleTheme} className="h-8 w-8 inline-flex items-center justify-center border border-border bg-transparent text-text-secondary hover:text-text-primary">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button className="relative h-8 w-8 inline-flex items-center justify-center border border-border bg-transparent text-text-secondary hover:text-text-primary">
                    <Bell size={18} />
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 text-[10px] font-mono leading-4 bg-accent text-accent-foreground border border-border rounded-sm">
                        2
                    </span>
                </button>
                <button
                    onClick={() => setModalOpen(true)}
                    className="h-8 px-3 bg-accent text-accent-foreground text-sm font-medium"
                >
                    New Run
                </button>
            </div>

            <NewRunModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onRunCreated={handleRunCreated} />
        </header>
    );
};
