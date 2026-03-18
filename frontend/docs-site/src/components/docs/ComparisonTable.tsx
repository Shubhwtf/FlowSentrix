import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

type ComparisonRow = {
  feature: string;
  values: Array<boolean | string>;
};

type ComparisonTableProps = {
  headers: string[];
  rows: ComparisonRow[];
};

export function ComparisonTable({ headers, rows }: ComparisonTableProps) {
  return (
    <div className="border border-border rounded-md overflow-hidden bg-surface">
      <table className="w-full border-collapse">
        <thead className="bg-surface-elevated border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left font-mono text-[12px] uppercase tracking-wide text-text-muted">Feature</th>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-mono text-[12px] uppercase tracking-wide text-text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.feature} style={{ background: rowIndex % 2 === 0 ? 'transparent' : 'rgb(var(--accent) / 0.02)' }}>
              <td className="px-4 py-3 text-[13px] text-text-primary">{row.feature}</td>
              {row.values.map((value, index) => (
                <td key={`${row.feature}-${index}`} className="px-4 py-3 text-[13px] text-text-secondary">
                  {typeof value === 'boolean' ? (
                    value ? <CheckCircle size={18} style={{ color: 'rgb(var(--success))' }} /> : <XCircle size={18} style={{ color: 'rgb(var(--destructive))' }} />
                  ) : (
                    value
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

