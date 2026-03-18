import React from 'react';
import { CodeBlock } from './CodeBlock';

export type StepItem = {
  title: string;
  description: string;
  code?: { language: string; content: string; filename?: string };
};

export function StepList({ steps }: { steps: StepItem[] }) {
  return (
    <div className="space-y-8">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <div key={step.title} className="flex gap-6">
            <div className="flex flex-col items-center">
              <div className="font-mono font-semibold text-[32px] leading-none text-text-muted">{index + 1}</div>
              {!isLast && <div className="w-px flex-1 bg-border mt-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-text-primary">{step.title}</div>
              <div className="mt-2 text-[14px] text-text-secondary leading-[1.7] whitespace-pre-wrap">{step.description}</div>
              {step.code && (
                <div className="mt-4">
                  <CodeBlock code={step.code.content} language={step.code.language} filename={step.code.filename} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

