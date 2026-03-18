import React from 'react';
import { StepList } from '../components/docs/StepList';
import { CodeBlock } from '../components/docs/CodeBlock';

export function Publishing() {
  const listingText = `FlowSentrix — Confidence-Gated Self-Healing Workflows

FlowSentrix is an agent-based workflow system designed for failure by default. Every step produces a confidence score, unsafe outputs are blocked before writes, and a bounded healing loop diagnoses and retries. When retries are exhausted, the system rolls back to a safe snapshot and replays with a corrected strategy. If automation cannot safely proceed, HITL triggers with Slack + email and a resumable approval flow.`;

  const steps = [
    { title: 'Prepare screenshots', description: 'Capture the dashboard run view, the workflow builder, an autopsy report, and a Slack message mockup.' },
    { title: 'Write the listing description', description: 'Use the listing text below as a base. Keep it technical and grounded in what the system actually does.' },
    { title: 'Add tags', description: 'Active agents, self-healing, rollback, HITL, Groq, LLaMA, Fastify, Postgres, Redis, Slack, GitHub.' },
    { title: 'Publish', description: 'Follow the Airia Community submission flow, then verify the demo instructions are reproducible from a fresh clone.' }
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="publishing" className="text-2xl font-bold tracking-tight">Publishing</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          Publishing is part of the demo. Judges care that the system is usable by someone who did not watch you build it. Treat the
          listing as a reproducibility contract: what to run, what to expect, and what the “winning moments” look like on screen.
        </p>
      </section>

      <section className="space-y-6">
        <h2 id="steps" className="text-xl font-bold tracking-tight">Steps</h2>
        <StepList steps={steps} />
      </section>

      <section className="space-y-4">
        <h2 id="agent-listing-text" className="text-xl font-bold tracking-tight">Agent listing text</h2>
        <CodeBlock code={listingText} language="text" />
      </section>
    </div>
  );
}

