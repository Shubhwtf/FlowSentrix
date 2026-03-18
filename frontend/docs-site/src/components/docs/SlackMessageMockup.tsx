import React from 'react';

type SlackField = { label: string; value: string };

type SlackMessageMockupProps = {
  title: string;
  color: string;
  fields: SlackField[];
  buttonLabel?: string;
  buttonColor?: string;
};

export function SlackMessageMockup({ title, color, fields, buttonLabel, buttonColor }: SlackMessageMockupProps) {
  return (
    <div className="border border-border rounded-md overflow-hidden" style={{ background: 'rgb(var(--surface))' }}>
      <div className="p-4 border-l-[4px]" style={{ borderLeftColor: color }}>
        <div className="text-[14px] font-semibold text-text-primary">{title}</div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map((field) => (
            <div key={field.label}>
              <div className="font-mono text-[11px] uppercase tracking-wide text-text-muted">{field.label}</div>
              <div className="text-[13px] text-text-primary mt-1 whitespace-pre-wrap">{field.value}</div>
            </div>
          ))}
        </div>
        {buttonLabel && (
          <div className="mt-5">
            <div className="inline-flex items-center px-3 py-2 border border-border rounded-md text-[12px] font-semibold" style={{ background: buttonColor ?? 'rgb(var(--surface-elevated))', color: 'rgb(var(--text-primary))' }}>
              {buttonLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

