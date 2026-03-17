import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';
import { ChevronDown, ChevronRight, FileText, Clock } from 'lucide-react';

export const CollapsibleAutopsy: React.FC<{ runId: string }> = ({ runId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [autopsy, setAutopsy] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!runId) return;
        setLoading(true);
        API.runs.getAutopsy(runId)
            .then(data => {
                setAutopsy(data);
                if (data) setIsOpen(true); // Automatically open if it exists
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [runId]);

    if (loading) return null; // Or a subtle spinner if preferred
    if (!autopsy) return null; // Don't render the section if there's no autopsy

    let parsed: any = {};
    try {
        parsed = typeof autopsy.content_json === 'string' ? JSON.parse(autopsy.content_json) : autopsy.content_json;
    } catch { }

    return (
        <div className="mt-4 border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-black font-mono shadow-inner">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-fs-surface-light dark:bg-fs-surface-dark hover:bg-white/5 transition-colors group"
            >
                <div className="flex items-center space-x-3">
                    {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    <FileText size={14} className="text-purple-500" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-fs-text-light dark:text-fs-text-dark">
                        Post-Mortem Autopsy Report
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${parsed.success ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {parsed.success ? 'HEALED' : 'HITL ESCALATION'}
                    </span>
                </div>
                <div className="flex items-center space-x-2 text-[10px] text-gray-500">
                    <Clock size={12} />
                    <span>{new Date(autopsy.generated_at).toLocaleTimeString()}</span>
                </div>
            </button>

            {isOpen && (
                <div className="p-4 border-t border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-bg-dark text-xs text-gray-600 dark:text-gray-300 leading-relaxed overflow-x-auto">
                    <pre className="whitespace-pre-wrap font-mono custom-scrollbar">{parsed.report || 'No detailed report available.'}</pre>
                </div>
            )}
        </div>
    );
};
