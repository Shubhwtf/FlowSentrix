import React from 'react';
import { EventBadge } from './EventBadge';

type AgentFlowCardProps = {
  name: string;
  role: string;
  subscribesTo: string[];
  publishes: string[];
  tools: string[];
  description: string;
};

const tags = (items: string[], type: 'publishes' | 'subscribes' | 'neutral') => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <EventBadge key={item} event={item} type={type} />
    ))}
  </div>
);

export function AgentFlowCard({ name, role, subscribesTo, publishes, tools, description }: AgentFlowCardProps) {
  return (
    <div className="bg-surface border border-border rounded-md p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[16px] font-semibold">{name}</h3>
        <span className="font-mono text-[11px] text-text-muted">{role}</span>
      </div>
      <p className="mt-3 text-[13px] text-text-secondary leading-6">{description}</p>
      <div className="mt-5 space-y-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted mb-2">SUBSCRIBES TO</div>
          {tags(subscribesTo, 'subscribes')}
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted mb-2">PUBLISHES</div>
          {tags(publishes, 'publishes')}
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted mb-2">TOOLS</div>
          {tags(tools, 'neutral')}
        </div>
      </div>
    </div>
  );
}

