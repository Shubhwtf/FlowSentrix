import React, { useEffect, useState } from 'react';
import { API } from '../../api/client';

interface HitlEvent {
    id: string;
    run_id: string;
    step_id: string;
    llm_briefing: string | null;
    status: string;
    decision: string | null;
    decided_at: string | null;
}

type PanelMode = 'idle' | 'reviewing' | 'modifying';

export const HITLQueue: React.FC = () => {
    const [events, setEvents] = useState<HitlEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [panelMode, setPanelMode] = useState<PanelMode>('idle');
    const [instructions, setInstructions] = useState('');
    const [modifyFields, setModifyFields] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const loadData = () => {
        API.hitl.list().then((data: HitlEvent[]) => { setEvents(data); setLoading(false); }).catch(e => { console.error(e); setLoading(false); });
    };

    useEffect(() => { loadData(); }, []);

    const openPanel = (id: string, mode: PanelMode) => {
        setActiveId(id);
        setPanelMode(mode);
        setInstructions('');
        setModifyFields({ action: '', value: '', reason: '' });
    };

    const closePanel = () => {
        setActiveId(null);
        setPanelMode('idle');
        setInstructions('');
        setModifyFields({});
    };

    const handleApprove = async (id: string) => {
        setSubmitting(true);
        try {
            await API.hitl.approve(id);
            closePanel();
            loadData();
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async (id: string) => {
        setSubmitting(true);
        try {
            await API.hitl.reject(id, instructions);
            closePanel();
            loadData();
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleModify = async (id: string) => {
        setSubmitting(true);
        try {
            const nonEmptyFields = Object.fromEntries(
                Object.entries(modifyFields).filter(([, v]) => v.trim() !== '')
            );
            await API.hitl.modify(id, { modifiedInput: nonEmptyFields });
            closePanel();
            loadData();
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight font-mono uppercase">HITL Escalation Queue</h1>
                <span className="font-mono text-sm px-3 py-1 bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark">
                    {events.filter(e => e.status === 'PENDING').length} PENDING
                </span>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500 font-mono text-sm">Loading HITL requests...</div>
            ) : (
                <div className="space-y-4">
                    {events.map(event => (
                        <div key={event.id} className={`p-5 border bg-white dark:bg-fs-surface-dark transition-colors ${event.status === 'PENDING' ? 'border-fs-border-light dark:border-fs-border-dark shadow-sm' : 'border-dashed border-gray-200 dark:border-gray-800 opacity-50'}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-4">
                                    <div className="relative flex-shrink-0 mt-1">
                                        {event.status === 'PENDING' && (
                                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        )}
                                        <div className="w-10 h-10 bg-fs-surface-light dark:bg-fs-bg-dark border border-fs-border-light dark:border-fs-border-dark flex items-center justify-center font-mono font-bold">?</div>
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Manual Review Required</h3>
                                        <p className="text-xs font-mono text-gray-500 mt-0.5">Run: {event.run_id?.split('-')[0]} | Status: {event.status}</p>
                                        {event.llm_briefing && (
                                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-w-lg">{event.llm_briefing}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-shrink-0 ml-4">
                                    {event.status === 'PENDING' ? (
                                        activeId === event.id ? (
                                            <div className="flex flex-col items-end space-y-2 w-72">
                                                {panelMode === 'reviewing' && (
                                                    <>
                                                        <textarea
                                                            value={instructions}
                                                            onChange={e => setInstructions(e.target.value)}
                                                            placeholder="Instructions (required for rejection)"
                                                            className="w-full h-20 text-xs font-mono p-2 border border-fs-border-light dark:border-fs-border-dark bg-fs-surface-light dark:bg-fs-bg-dark outline-none focus:border-fs-cyan"
                                                        />
                                                        <div className="flex space-x-2 w-full">
                                                            <button onClick={closePanel} disabled={submitting} className="flex-1 px-2 py-1.5 font-mono text-xs border border-fs-border-light dark:border-fs-border-dark text-gray-500">CANCEL</button>
                                                            <button onClick={() => openPanel(event.id, 'modifying')} disabled={submitting} className="flex-1 px-2 py-1.5 font-mono text-xs border border-fs-cyan text-fs-cyan hover:bg-fs-cyan/10">MODIFY</button>
                                                            <button onClick={() => handleReject(event.id)} disabled={submitting || !instructions.trim()} className="flex-1 px-2 py-1.5 font-mono text-xs border border-red-500/50 text-red-500 hover:bg-red-500/10 disabled:opacity-50">REJECT</button>
                                                            <button onClick={() => handleApprove(event.id)} disabled={submitting} className="flex-1 px-2 py-1.5 font-mono text-xs bg-fs-cyan text-black hover:bg-opacity-90 disabled:opacity-50">APPROVE</button>
                                                        </div>
                                                    </>
                                                )}

                                                {panelMode === 'modifying' && (
                                                    <div className="w-full space-y-2">
                                                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Override Step Input</p>
                                                        {Object.keys(modifyFields).map(fieldKey => (
                                                            <div key={fieldKey} className="flex flex-col space-y-0.5">
                                                                <label className="text-[10px] font-mono text-gray-500 uppercase">{fieldKey}</label>
                                                                <input
                                                                    value={modifyFields[fieldKey]}
                                                                    onChange={e => setModifyFields(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                    className="text-xs font-mono p-2 border border-fs-border-light dark:border-fs-border-dark bg-fs-surface-light dark:bg-fs-bg-dark outline-none focus:border-fs-cyan"
                                                                />
                                                            </div>
                                                        ))}
                                                        <div className="flex space-x-2 pt-2">
                                                            <button onClick={() => openPanel(event.id, 'reviewing')} disabled={submitting} className="flex-1 px-2 py-1.5 font-mono text-xs border border-fs-border-light dark:border-fs-border-dark text-gray-500">BACK</button>
                                                            <button
                                                                onClick={() => handleModify(event.id)}
                                                                disabled={submitting || Object.values(modifyFields).every(v => !v.trim())}
                                                                className="flex-1 px-2 py-1.5 font-mono text-xs bg-fs-cyan text-black hover:bg-opacity-90 disabled:opacity-50"
                                                            >
                                                                SUBMIT MODIFICATION
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => openPanel(event.id, 'reviewing')}
                                                className="bg-fs-cyan text-black px-6 py-2 font-medium font-mono text-xs hover:bg-opacity-90 transition-opacity"
                                            >
                                                REVIEW
                                            </button>
                                        )
                                    ) : (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="font-mono text-xs px-3 py-1 bg-fs-surface-light dark:bg-black uppercase border border-fs-border-light dark:border-fs-border-dark text-gray-500">{event.status}</span>
                                            {event.decision && <span className={`font-mono text-[10px] uppercase ${event.decision === 'approve' ? 'text-green-500' : event.decision === 'modify' ? 'text-fs-cyan' : 'text-red-500'}`}>{event.decision}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {events.length === 0 && (
                        <div className="p-8 text-center text-gray-500 font-mono text-sm border border-dashed border-fs-border-light dark:border-fs-border-dark">
                            No HITL escalations found. Healer Agent will escalate failed steps here.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
