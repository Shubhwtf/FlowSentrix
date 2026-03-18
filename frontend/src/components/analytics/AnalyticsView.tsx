import React, { useCallback, useState } from 'react';
import { RunVolumeChart } from './RunVolumeChart';
import { ConfidenceHistogram } from './ConfidenceHistogram';
import { HealingDonut } from './HealingDonut';
import { FailurePatterns } from './FailurePatterns';
import { API } from '../../api/client';

export const AnalyticsView: React.FC = () => {
    const [exporting, setExporting] = useState(false);

    const handleExportCsv = useCallback(async () => {
        if (exporting) return;
        setExporting(true);
        try {
            const [overview, runs30d, healing, confidence] = await Promise.all([
                API.analytics.overview().catch(() => null),
                API.analytics.runsByPeriod('month').catch(() => []),
                API.analytics.healing().catch(() => null),
                API.analytics.confidence().catch(() => []),
            ]);

            const rows: Array<Record<string, string | number | null>> = [];
            const nowIso = new Date().toISOString();

            rows.push({ section: 'meta', key: 'generated_at', value: nowIso });

            if (overview && typeof overview === 'object') {
                Object.entries(overview as Record<string, unknown>).forEach(([key, value]) => {
                    const printable = typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value);
                    rows.push({ section: 'overview', key, value: printable });
                });
            }

            if (Array.isArray(runs30d)) {
                (runs30d as Array<Record<string, unknown>>).forEach((point) => {
                    rows.push({
                        section: 'runs_30d',
                        date: typeof point.date === 'string' ? point.date : '',
                        total: typeof point.total === 'number' ? point.total : 0,
                        succeeded: typeof point.succeeded === 'number' ? point.succeeded : 0,
                        failed: typeof point.failed === 'number' ? point.failed : 0,
                        healed: typeof point.healed === 'number' ? point.healed : 0,
                    });
                });
            }

            if (healing && typeof healing === 'object') {
                Object.entries(healing as Record<string, unknown>).forEach(([key, value]) => {
                    const printable = typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value);
                    rows.push({ section: 'healing', key, value: printable });
                });
            }

            if (Array.isArray(confidence)) {
                (confidence as Array<{ bucket: string; count: number }>).forEach((b) => {
                    rows.push({ section: 'confidence', bucket: b.bucket, count: b.count });
                });
            }

            const headers = Array.from(
                rows.reduce((set, row) => {
                    Object.keys(row).forEach((k) => set.add(k));
                    return set;
                }, new Set<string>())
            );

            const esc = (v: unknown) => {
                if (v === null || v === undefined) return '';
                const s = String(v);
                if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
                return s;
            };

            const csv = [
                headers.join(','),
                ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(',')),
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flowsentrix_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    }, [exporting]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-2xl font-bold tracking-tight">System Analytics</h1>
                <button
                    onClick={handleExportCsv}
                    disabled={exporting}
                    className="px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest bg-black text-white dark:bg-white dark:text-black hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                    {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <RunVolumeChart />
                <ConfidenceHistogram />
                <HealingDonut />
                <FailurePatterns />
            </div>
        </div>
    );
};
