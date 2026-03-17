import React, { useEffect, useState } from 'react';
import { API } from '../../api/client';
import { X, AlertTriangle, CheckCircle, Clock, FileText, Download } from 'lucide-react';

// Minimal markdown renderer — handles bold, italic, headings, bullets, and paragraphs
const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) { elements.push(<div key={i} className="h-3" />); i++; continue; }

        // Headings
        if (line.startsWith('### ')) {
            elements.push(<h3 key={i} className="text-sm font-bold text-fs-text-light dark:text-fs-text-dark uppercase tracking-widest mt-4 mb-1">{line.slice(4)}</h3>);
            i++; continue;
        }
        if (line.startsWith('## ')) {
            elements.push(<h2 key={i} className="text-base font-bold text-fs-cyan mt-5 mb-2">{line.slice(3)}</h2>);
            i++; continue;
        }
        if (line.startsWith('# ')) {
            elements.push(<h1 key={i} className="text-lg font-bold text-fs-text-light dark:text-fs-text-dark mt-4 mb-2">{line.slice(2)}</h1>);
            i++; continue;
        }

        // Bullet
        if (line.match(/^[\*\-\d\.]\s/)) {
            const items: string[] = [];
            while (i < lines.length && lines[i].match(/^[\*\-\d\.]\s/)) {
                items.push(lines[i].replace(/^[\*\-\d\.]\s/, ''));
                i++;
            }
            elements.push(
                <ul key={`ul-${i}`} className="list-none space-y-1 my-2">
                    {items.map((item, j) => (
                        <li key={j} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-300">
                            <span className="text-fs-cyan mt-1 shrink-0">▸</span>
                            <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        // Normal paragraph
        elements.push(
            <p key={i} className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />
        );
        i++;
    }
    return elements;
};

const inlineMarkdown = (text: string) =>
    text
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-fs-text-light dark:text-fs-text-dark font-semibold">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em class="italic text-gray-500">$1</em>');

interface AutopsyParsed {
    report: string;
    success: boolean;
    strategies: Array<{ rootCause: string; strategy: string }>;
    confidenceHistory: number[];
}

const AutopsyModal: React.FC<{ row: any; onClose: () => void }> = ({ row, onClose }) => {
    let parsed: AutopsyParsed = { report: '', success: false, strategies: [], confidenceHistory: [] };
    try {
        parsed = typeof row.content_json === 'string' ? JSON.parse(row.content_json) : row.content_json;
    } catch { parsed.report = 'Invalid report format.'; }

    const strategies = parsed.strategies || [];

    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = `/api/runs/${row.run_id}/autopsy/pdf`;
        a.download = `autopsy-${row.run_id.split('-')[0]}-${new Date(row.generated_at).toISOString().slice(0, 10)}.pdf`;
        a.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="h-full w-full max-w-2xl bg-white dark:bg-fs-bg-dark border-l border-fs-border-light dark:border-fs-border-dark flex flex-col shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-fs-border-light dark:border-fs-border-dark bg-fs-surface-light dark:bg-fs-surface-dark">
                    <div className="flex items-center space-x-3">
                        <FileText size={18} className="text-purple-500" />
                        <div>
                            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Autopsy Report</p>
                            <p className="font-bold font-mono text-sm text-fs-text-light dark:text-fs-text-dark">
                                Run: <span className="text-fs-cyan">{row.run_id?.split('-')[0]}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleDownload}
                            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono border border-fs-border-light dark:border-fs-border-dark text-gray-500 hover:text-fs-text-light dark:hover:text-fs-text-dark hover:border-fs-cyan transition-colors"
                        >
                            <Download size={13} />
                            <span>DOWNLOAD</span>
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-fs-text-light dark:hover:text-fs-text-dark transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Meta strip */}
                <div className="flex items-center space-x-6 px-6 py-3 border-b border-fs-border-light dark:border-fs-border-dark text-xs font-mono bg-white/50 dark:bg-black/20">
                    <div className="flex items-center space-x-2">
                        {parsed.success
                            ? <CheckCircle size={13} className="text-green-500" />
                            : <AlertTriangle size={13} className="text-red-500" />}
                        <span className={parsed.success ? 'text-green-500' : 'text-red-500'}>
                            {parsed.success ? 'RESOLVED' : 'ESCALATED'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-500">
                        <Clock size={12} />
                        <span>{new Date(row.generated_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-500">
                        <span>{strategies.length} strateg{strategies.length === 1 ? 'y' : 'ies'} attempted</span>
                    </div>
                </div>

                {/* Strategies */}
                {strategies.length > 0 && (
                    <div className="px-6 py-4 border-b border-fs-border-light dark:border-fs-border-dark">
                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Strategies Attempted</p>
                        <div className="flex flex-wrap gap-2">
                            {strategies.map((s, i) => (
                                <div key={i} className="flex items-center space-x-2 px-3 py-1.5 bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark text-xs font-mono">
                                    <span className="text-gray-500">#{i + 1}</span>
                                    <span className="text-amber-400">{s.strategy}</span>
                                    {s.rootCause !== 'Unknown' && <span className="text-gray-500">— {s.rootCause}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Confidence Sparkline */}
                {parsed.confidenceHistory && parsed.confidenceHistory.length > 1 && (() => {
                    const scores = parsed.confidenceHistory;
                    const svgWidth = 200;
                    const svgHeight = 60;
                    const xStep = scores.length > 1 ? svgWidth / (scores.length - 1) : svgWidth;
                    const points = scores.map((s, i) => `${(i * xStep).toFixed(1)},${(((100 - s) / 100) * svgHeight).toFixed(1)}`).join(' ');
                    const dots = scores.map((s, i) => (
                        <circle key={i} cx={(i * xStep).toFixed(1)} cy={(((100 - s) / 100) * svgHeight).toFixed(1)} r="3" fill="var(--text-primary)">
                            <title>{s}</title>
                        </circle>
                    ));
                    return (
                        <div className="px-6 py-4 border-t border-fs-border-light dark:border-fs-border-dark">
                            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Confidence Score History</p>
                            <div className="bg-fs-surface-light dark:bg-black p-3 border border-fs-border-light dark:border-fs-border-dark">
                                <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                                    <polyline points={points} fill="none" stroke="var(--text-primary)" strokeWidth="2" />
                                    {dots}
                                </svg>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-gray-500 mt-1">
                                <span>Step 1</span>
                                <span>Step {scores.length}</span>
                            </div>
                        </div>
                    );
                })()}

                {/* Report body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1 custom-scrollbar">
                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">LLM-Generated Report</p>
                    {parsed.report ? renderMarkdown(parsed.report) : (
                        <p className="text-sm text-gray-500 italic">No report content available.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export const AutopsyList: React.FC = () => {
    const [autopsies, setAutopsies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any | null>(null);

    useEffect(() => {
        API.autopsies.list()
            .then(data => { setAutopsies(data); setLoading(false); })
            .catch(e => { console.error(e); setLoading(false); });
    }, []);

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight font-mono uppercase">Autopsy Reports</h1>
                <span className="font-mono text-xs px-3 py-1 bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark">{autopsies.length} REPORTS</span>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500 font-mono text-sm">Loading autopsy reports...</div>
            ) : (
                <div className="border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-surface-dark overflow-hidden">
                    <table className="w-full text-left font-mono text-sm">
                        <thead className="bg-fs-surface-light dark:bg-fs-bg-dark border-b border-fs-border-light dark:border-fs-border-dark text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Run ID</th>
                                <th className="px-6 py-4 font-semibold">Generated At</th>
                                <th className="px-6 py-4 font-semibold">Outcome</th>
                                <th className="px-6 py-4 font-semibold">Strategies</th>
                                <th className="px-6 py-4 font-semibold">Report Preview</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-fs-border-light dark:divide-fs-border-dark">
                            {autopsies.map(row => {
                                let reportText = '';
                                let success = false;
                                let strategies: any[] = [];
                                try {
                                    const parsed = typeof row.content_json === 'string' ? JSON.parse(row.content_json) : row.content_json;
                                    reportText = parsed.report || '';
                                    success = parsed.success ?? false;
                                    strategies = parsed.strategies || [];
                                } catch { reportText = 'Invalid format.'; }

                                // Strip markdown from preview
                                const previewText = reportText.replace(/[#*`_]/g, '').replace(/\n+/g, ' ').trim();

                                return (
                                    <tr
                                        key={row.id}
                                        className="hover:bg-fs-surface-light dark:hover:bg-black/20 transition-colors cursor-pointer group"
                                        onClick={() => setSelected(row)}
                                    >
                                        <td className="px-6 py-4 text-fs-cyan" title={row.run_id}>
                                            {row.run_id.split('-')[0]}…
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {new Date(row.generated_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider border ${success ? 'text-green-500 border-green-500/30 bg-green-500/10' : 'text-red-500 border-red-500/30 bg-red-500/10'}`}>
                                                {success ? 'RESOLVED' : 'FAILED'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {strategies.length} attempt{strategies.length !== 1 ? 's' : ''}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="line-clamp-2 max-w-xl text-gray-500 dark:text-gray-400 group-hover:text-fs-text-light dark:group-hover:text-fs-text-dark transition-colors text-xs">
                                                {previewText.substring(0, 200)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {autopsies.length === 0 && (
                        <div className="p-8 text-center text-gray-500 font-mono text-sm">
                            No autopsy reports yet. Trigger a failing run to generate one automatically.
                        </div>
                    )}
                </div>
            )}

            {selected && <AutopsyModal row={selected} onClose={() => setSelected(null)} />}
        </div>
    );
};
