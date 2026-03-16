import React, { useState, useEffect, useRef } from 'react';
import { API } from '../../api/client';
import { Loader2, Download, PlayCircle } from 'lucide-react';

export const ComplianceView: React.FC = () => {
    const [frameworks, setFrameworks] = useState<string[]>([]);
    const [selected, setSelected] = useState<string>('');
    const [controls, setControls] = useState<any[]>([]);
    const [gaps, setGaps] = useState<any[]>([]);
    const [generating, setGenerating] = useState(false);
    const [lastRunId, setLastRunId] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadData = () => {
        API.compliance.getReport().then(({ controls: c, gaps: g }) => {
            const validControls = Array.isArray(c) ? c : [];
            const validGaps = Array.isArray(g) ? g : [];
            setControls(validControls);
            setGaps(validGaps);
            const fw = validControls.map((item: any) => item.framework).filter(Boolean);
            const uniqueFw = Array.from(new Set(fw)) as string[];
            setFrameworks(uniqueFw.length > 0 ? uniqueFw : []);
            if (uniqueFw.length > 0 && !selected) setSelected(uniqueFw[0]);
        }).catch(err => console.error(err));
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poll for compliance data while generating
    useEffect(() => {
        if (!generating || !lastRunId) return;
        pollRef.current = setInterval(async () => {
            const updated = await API.compliance.getReport().catch(() => null);
            if (updated?.controls?.length > 0) {
                const validControls = Array.isArray(updated.controls) ? updated.controls : [];
                const validGaps = Array.isArray(updated.gaps) ? updated.gaps : [];
                setControls(validControls);
                setGaps(validGaps);
                const fw = validControls.map((item: any) => item.framework).filter(Boolean);
                const uniqueFw = Array.from(new Set(fw)) as string[];
                setFrameworks(uniqueFw.length > 0 ? uniqueFw : []);
                if (uniqueFw.length > 0) setSelected(s => s || uniqueFw[0]);
                setGenerating(false);
                if (pollRef.current) clearInterval(pollRef.current);
            }
        }, 6000);

        const timeout = setTimeout(() => {
            setGenerating(false);
            if (pollRef.current) clearInterval(pollRef.current);
        }, 240000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            clearTimeout(timeout);
        };
    }, [generating, lastRunId]);

    const handleGenerate = async () => {
        setGenerating(true);
        setControls([]);
        setGaps([]);
        try {
            const res = await API.compliance.triggerRun({ framework: selected || 'SOC2', scope: 'all' });
            setLastRunId(res.runId);
        } catch (e) {
            console.error(e);
            setGenerating(false);
        }
    };

    const handleDownload = () => {
        const lines: string[] = [];
        lines.push(`COMPLIANCE REPORT — ${selected}`);
        lines.push(`Generated: ${new Date().toLocaleString()}`);
        lines.push('');
        lines.push('=== CONTROLS ===');
        relevantControls.forEach(c => lines.push(`[${c.status}] ${c.id}  ${c.description}  Score: ${c.score}`));
        lines.push('');
        lines.push('=== GAPS ===');
        relevantGaps.forEach(g => lines.push(`• ${g.description}\n  Action: ${g.action_required}  (Effort: ${g.effort})`));
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance_report_${selected}_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const relevantControls = controls.filter(c => c.framework === selected);
    const relevantGaps = gaps.filter(g => g.framework === selected);
    const maxScore = relevantControls.length * 100;
    const currentScore = relevantControls.reduce((sum, c) => sum + (c.score || 0), 0);
    const summaryScore = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0;
    const isPassing = summaryScore >= 80;

    return (
        <div className="max-w-4xl mx-auto flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h1 className="text-2xl font-bold tracking-tight">Compliance Center</h1>
                <div className="flex space-x-3">
                    {(relevantControls.length > 0 || relevantGaps.length > 0) && (
                        <button
                            onClick={handleDownload}
                            className="flex items-center space-x-2 text-xs font-mono border border-fs-border-light dark:border-fs-border-dark px-4 py-1.5 transition-colors hover:bg-fs-surface-light dark:hover:bg-fs-surface-dark"
                        >
                            <Download size={12} />
                            <span>Download Report</span>
                        </button>
                    )}
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center space-x-2 text-xs font-mono bg-fs-cyan text-black px-4 py-1.5 font-bold hover:bg-opacity-90 transition-opacity disabled:opacity-60"
                    >
                        {generating ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                        <span>{generating ? 'Running Audit…' : 'Generate New Report'}</span>
                    </button>
                </div>
            </div>

            {generating && (
                <div className="mb-4 border border-fs-cyan/30 bg-fs-cyan/5 p-4 font-mono text-xs text-fs-cyan flex items-center space-x-3">
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    <span>Compliance audit pipeline is running. The LLM is collecting evidence and mapping controls to {selected || 'SOC2'} — this takes 1–3 minutes. Data will appear automatically when ready.</span>
                </div>
            )}

            {frameworks.length > 0 && (
                <div className="flex space-x-6 border-b border-fs-border-light dark:border-fs-border-dark mb-6 shrink-0">
                    {frameworks.map(fw => (
                        <button
                            key={fw}
                            onClick={() => setSelected(fw)}
                            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${selected === fw ? 'border-fs-cyan text-fs-text-light dark:text-fs-text-dark' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                        >
                            {fw}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-6">
                <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 flex justify-between items-center">
                    <div>
                        <h3 className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-1">Executive Summary</h3>
                        <p className="text-lg font-bold">{selected || 'No Framework Selected'} Readiness Assessment</p>
                    </div>
                    {selected && relevantControls.length > 0 ? (
                        <div className="flex items-center space-x-4">
                            <span className={`font-mono text-4xl font-bold ${isPassing ? 'text-green-500' : 'text-amber-500'}`}>{summaryScore}%</span>
                            <div className={`w-12 h-12 rounded-full border-4 ${isPassing ? 'border-green-500 text-green-500' : 'border-amber-500 text-amber-500'} flex items-center justify-center font-mono text-xs font-bold`}>
                                {isPassing ? 'PASS' : 'WARN'}
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 font-mono text-xs uppercase">
                            {generating ? 'Audit in progress…' : 'No report data. Click Generate.'}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6">
                        <h3 className="font-bold tracking-tight mb-4 uppercase text-xs text-gray-500">Control Areas</h3>
                        <div className="space-y-3">
                            {relevantControls.length === 0 ? (
                                <p className="text-sm font-mono text-gray-500">{generating ? 'Awaiting audit results…' : 'No controls yet. Generate a report.'}</p>
                            ) : relevantControls.map(c => (
                                <div key={c.id} className="flex justify-between items-center text-sm font-mono border-b border-fs-border-light dark:border-fs-border-dark pb-2 last:border-0">
                                    <div className="flex space-x-3">
                                        <span className="font-bold">{c.id}</span>
                                        <span className="text-gray-500 truncate w-40" title={c.description}>{c.description}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider bg-black/5 dark:bg-white/5 ${c.status === 'PASS' ? 'text-green-500' : 'text-red-500'}`}>{c.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6">
                        <h3 className="font-bold tracking-tight mb-4 uppercase text-xs text-gray-500">Actionable Gaps</h3>
                        <div className="space-y-4">
                            {relevantGaps.length === 0 ? (
                                <p className="text-sm font-mono text-gray-500">{generating ? 'Identifying gaps…' : 'No gaps found.'}</p>
                            ) : (
                                relevantGaps.map((g, i) => (
                                    <div key={i} className="flex flex-col space-y-1">
                                        <span className="text-sm font-medium">{g.description}</span>
                                        <div className="flex justify-between items-end font-mono text-[10px] text-gray-500 uppercase">
                                            <span>Action: {g.action_required}</span>
                                            <span className={g.effort === 'Low' ? 'text-green-500' : 'text-amber-500'}>Effort: {g.effort}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
