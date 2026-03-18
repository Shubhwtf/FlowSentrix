import React from 'react';

export type PropDefinition = {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
};

export function PropTable({ props }: { props: PropDefinition[] }) {
  return (
    <div className="border border-border rounded-md overflow-hidden bg-surface">
      <table className="w-full border-collapse">
        <thead className="bg-surface-elevated border-b border-border">
          <tr className="text-left">
            <th className="px-4 py-3 font-mono text-[12px] uppercase tracking-wide text-text-muted">Name</th>
            <th className="px-4 py-3 font-mono text-[12px] uppercase tracking-wide text-text-muted">Type</th>
            <th className="px-4 py-3 font-mono text-[12px] uppercase tracking-wide text-text-muted">Required</th>
            <th className="px-4 py-3 font-mono text-[12px] uppercase tracking-wide text-text-muted">Default</th>
            <th className="px-4 py-3 font-mono text-[12px] uppercase tracking-wide text-text-muted">Description</th>
          </tr>
        </thead>
        <tbody>
          {props.map((row) => (
            <tr key={row.name} className="border-t border-border-subtle">
              <td className="px-4 py-3 font-mono text-[13px] text-text-primary whitespace-nowrap">{row.name}</td>
              <td className="px-4 py-3 font-mono text-[12px]" style={{ color: 'rgb(var(--info))' }}>
                {row.type}
              </td>
              <td className="px-4 py-3">
                {row.required ? (
                  <span className="inline-flex items-center px-2 py-1 text-[11px] font-mono border border-border rounded-md" style={{ background: 'rgb(var(--destructive) / 0.10)', color: 'rgb(var(--destructive))' }}>
                    required
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 text-[11px] font-mono border border-border rounded-md bg-surface-elevated text-text-muted">
                    optional
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-[12px] text-text-muted">{row.default ?? '—'}</td>
              <td className="px-4 py-3 text-[13px] text-text-secondary leading-6">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

