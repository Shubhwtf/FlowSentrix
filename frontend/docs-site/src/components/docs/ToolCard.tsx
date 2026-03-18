import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { PropTable, type PropDefinition } from './PropTable';

export type ToolDefinition = {
  name: string;
  description: string;
  status: 'mock' | 'real' | 'dual';
  envFlag: string;
  arguments: PropDefinition[];
  returnType: string;
  exampleCallJson: string;
  exampleReturnJson: string;
  realAdapter: { description: string; apiCalls: string[] };
  mockAdapter: { description: string; exactReturnJson: string };
};

type SectionKey = 'arguments' | 'returnType' | 'example' | 'adapters';

const sectionLabel: Record<SectionKey, string> = {
  arguments: 'Arguments',
  returnType: 'Return Type',
  example: 'Example',
  adapters: 'Adapters'
};

const badgeStyle = (status: ToolDefinition['status']) => {
  if (status === 'real') return { background: 'rgb(var(--success) / 0.10)', color: 'rgb(var(--success))', label: 'REAL' };
  if (status === 'mock') return { background: 'rgb(var(--warning) / 0.10)', color: 'rgb(var(--warning))', label: 'MOCK' };
  return { background: 'rgb(var(--info) / 0.10)', color: 'rgb(var(--info))', label: 'DUAL' };
};

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    arguments: true,
    returnType: false,
    example: false,
    adapters: false
  });

  const badge = useMemo(() => badgeStyle(tool.status), [tool.status]);

  const toggle = (key: SectionKey) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="bg-surface border border-border rounded-md p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h3 className="font-mono text-[15px] font-semibold truncate">{tool.name}</h3>
          <p className="mt-2 text-[13px] text-text-secondary leading-6">{tool.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2 py-1 border border-border rounded-md font-mono text-[11px]" style={badge}>
              {badge.label}
            </span>
            <span className="inline-flex items-center px-2 py-1 border border-border rounded-md font-mono text-[11px] bg-surface-elevated text-text-muted">
              {tool.envFlag}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {(['arguments', 'returnType', 'example', 'adapters'] as const).map((key) => {
          const isOpen = open[key];
          return (
            <div key={key} className="border border-border rounded-md overflow-hidden">
              <button onClick={() => toggle(key)} className="w-full px-4 py-3 bg-surface-elevated flex items-center justify-between">
                <span className="text-[13px] font-semibold">{sectionLabel[key]}</span>
                <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="text-text-muted">
                  <ChevronRight size={16} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="p-4">
                      {key === 'arguments' && <PropTable props={tool.arguments} />}
                      {key === 'returnType' && <CodeBlock code={tool.returnType} language="typescript" />}
                      {key === 'example' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <CodeBlock code={tool.exampleCallJson} language="json" filename="Tool call" />
                          <CodeBlock code={tool.exampleReturnJson} language="json" filename="Return value" />
                        </div>
                      )}
                      {key === 'adapters' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted">Real adapter</div>
                            <p className="text-[13px] text-text-secondary leading-6">{tool.realAdapter.description}</p>
                            <div className="mt-2 space-y-1">
                              {tool.realAdapter.apiCalls.map((call) => (
                                <div key={call} className="font-mono text-[12px] text-text-primary border border-border rounded-md px-2 py-1 bg-background">
                                  {call}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted">Mock adapter</div>
                            <p className="text-[13px] text-text-secondary leading-6">{tool.mockAdapter.description}</p>
                            <CodeBlock code={tool.mockAdapter.exactReturnJson} language="json" filename="Exact mock return" />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

