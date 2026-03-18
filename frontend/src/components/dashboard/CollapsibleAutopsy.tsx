import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';
import { ChevronDown, ChevronRight, FileText, Clock } from 'lucide-react';

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const markdownToHtmlLite = (md: string) => {
    const src = String(md || '').replace(/\r\n/g, '\n');
    const lines = src.split('\n');
    const out: string[] = [];
    let i = 0;

    const isTableSep = (line: string) => /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);
    const splitRow = (line: string) => {
        const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
        return trimmed.split('|').map(c => c.trim());
    };

    while (i < lines.length) {
        const line = lines[i];

        const h3 = line.match(/^###\s+(.*)$/);
        if (h3) { out.push(`<h3>${escapeHtml(h3[1])}</h3>`); i++; continue; }
        const h4 = line.match(/^####\s+(.*)$/);
        if (h4) { out.push(`<h4>${escapeHtml(h4[1])}</h4>`); i++; continue; }

        if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
            const header = splitRow(line);
            i += 2;
            const body: string[][] = [];
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
                body.push(splitRow(lines[i]));
                i++;
            }

            const thead = `<thead><tr>${header.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
            const tbody = `<tbody>${body.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
            out.push(`<table class="md-table">${thead}${tbody}</table>`);
            continue;
        }

        if (line.trim() === '') { i++; continue; }

        const para: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
            para.push(lines[i]);
            i++;
        }
        out.push(`<p>${escapeHtml(para.join(' '))}</p>`);
    }

    return out.join('\n');
};

const fmtJson = (v: any) => {
    try {
        if (typeof v === 'string') {
            const trimmed = v.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                return JSON.stringify(JSON.parse(trimmed), null, 2);
            }
            return v;
        }
        return JSON.stringify(v, null, 2);
    } catch {
        return String(v);
    }
};

const fmtDuration = (ms: number | null | undefined) => {
    if (!ms || ms < 0) return 'Unknown';
    const s = Math.floor(ms / 1000);
    const remMs = ms % 1000;
    if (s < 60) return `${s}.${String(Math.floor(remMs / 10)).padStart(2, '0')}s`;
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return `${m}m ${remS}s`;
};

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

    const outcomeLabel = parsed.success ? 'HEALED' : 'HITL ESCALATION';
    const outcomeClass = parsed.success ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500';

    const metaItems: Array<[string, string]> = [
        ['Workflow', parsed.workflowId || 'Unknown'],
        ['Failed Agent', parsed.failedAgentType || 'Unknown'],
        ['Failed Step', typeof parsed.failedStepIndex === 'number' ? String(parsed.failedStepIndex) : 'Unknown'],
        ['Final Step Status', parsed.finalStepStatus || 'Unknown'],
        ['Final Confidence', typeof parsed.finalConfidenceScore === 'number' ? String(parsed.finalConfidenceScore) : 'Unknown'],
        ['Started', parsed.runStartedAt ? new Date(parsed.runStartedAt).toLocaleString() : 'Unknown'],
        ['Completed', parsed.runCompletedAt ? new Date(parsed.runCompletedAt).toLocaleString() : 'Unknown'],
        ['Duration', fmtDuration(parsed.durationMs)]
    ];

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
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${outcomeClass}`}>
                        {outcomeLabel}
                    </span>
                </div>
                <div className="flex items-center space-x-2 text-[10px] text-gray-500">
                    <Clock size={12} />
                    <span>{new Date(autopsy.generated_at).toLocaleTimeString()}</span>
                </div>
            </button>

            {isOpen && (
                <div className="p-4 border-t border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-bg-dark text-xs text-gray-600 dark:text-gray-300 leading-relaxed overflow-x-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {metaItems.map(([k, v]) => (
                            <div key={k} className="border border-fs-border-light dark:border-fs-border-dark bg-black/5 dark:bg-black/20 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{k}</div>
                                <div className="mt-1 text-xs text-gray-700 dark:text-gray-200 break-words">{v}</div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 space-y-4">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Trigger Payload</div>
                            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] bg-black/5 dark:bg-black/20 p-3 border border-fs-border-light dark:border-fs-border-dark overflow-x-auto custom-scrollbar">{fmtJson(parsed.triggerPayload ?? {})}</pre>
                        </div>

                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Original Step Input</div>
                            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] bg-black/5 dark:bg-black/20 p-3 border border-fs-border-light dark:border-fs-border-dark overflow-x-auto custom-scrollbar">{fmtJson(parsed.originalStepInput ?? {})}</pre>
                        </div>

                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Original Error</div>
                            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] bg-black/5 dark:bg-black/20 p-3 border border-fs-border-light dark:border-fs-border-dark overflow-x-auto custom-scrollbar">{fmtJson(parsed.originalError ?? null)}</pre>
                        </div>

                        {Array.isArray(parsed.strategies) && parsed.strategies.length > 0 && (
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Healing Strategies</div>
                                <div className="space-y-2">
                                    {parsed.strategies.map((s: any, idx: number) => (
                                        <div key={idx} className="border border-fs-border-light dark:border-fs-border-dark bg-black/5 dark:bg-black/20 p-3">
                                            <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Root Cause</div>
                                            <div className="mt-1 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{s?.rootCause || 'Unknown'}</div>
                                            <div className="mt-3 text-[10px] uppercase tracking-widest text-fs-cyan font-bold">Strategy</div>
                                            <div className="mt-1 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{s?.strategy || 'Retry'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Narrative Report</div>
                            <div
                                className="prose prose-invert max-w-none prose-p:my-2 prose-h3:mt-4 prose-h3:mb-2 prose-h4:mt-3 prose-h4:mb-1 bg-black/5 dark:bg-black/20 p-3 border border-fs-border-light dark:border-fs-border-dark"
                                dangerouslySetInnerHTML={{ __html: markdownToHtmlLite(parsed.report || '') || '<p>No detailed report available.</p>' }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
