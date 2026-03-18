import React from 'react';

type EventBadgeProps = {
  event: string;
  type: 'publishes' | 'subscribes' | 'neutral';
};

const badgeStyle = (type: EventBadgeProps['type']) => {
  if (type === 'publishes') return { background: 'rgb(var(--success) / 0.10)', color: 'rgb(var(--success))' };
  if (type === 'subscribes') return { background: 'rgb(var(--info) / 0.10)', color: 'rgb(var(--info))' };
  return { background: 'rgb(var(--surface-elevated))', color: 'rgb(var(--text-muted))' };
};

export function EventBadge({ event, type }: EventBadgeProps) {
  const style = badgeStyle(type);
  return (
    <span className="inline-flex items-center px-2 py-1 border border-border rounded-md font-mono text-[11px]" style={style}>
      {event}
    </span>
  );
}

