import React from 'react';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';
import { ComparisonTable } from '../components/docs/ComparisonTable';
import { PropTable, type PropDefinition } from '../components/docs/PropTable';

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-surface border border-border rounded-md p-6">
      <div className="text-[15px] font-semibold">{title}</div>
      <p className="mt-2 text-[13px] text-text-secondary leading-6">{body}</p>
    </div>
  );
}

export function Introduction() {
  const comparisonHeaders = ['Typical Automation Tool', 'Enterprise Workflow Platform', 'FlowSentrix'];
  const comparisonRows = [
    { feature: 'Proactive confidence gating', values: [false, 'Limited', true] },
    { feature: 'Autonomous self-healing', values: [false, 'Partial', true] },
    { feature: 'Time travel rollback', values: [false, 'Rare', true] },
    { feature: 'Plain English autopsy reports', values: ['Basic logs', 'Ticketing', true] },
    { feature: 'HITL only as last resort', values: [false, false, true] },
    { feature: 'Open source LLM', values: [false, false, true] },
    { feature: 'Explainable agent decisions', values: [false, 'Compliance-only', true] },
    { feature: 'Visual workflow builder', values: ['Add-on', true, true] },
    { feature: 'Real GitHub integration', values: ['Scripts', true, true] },
    { feature: 'Real Slack integration', values: ['Webhooks', true, true] }
  ];

  const criteria: PropDefinition[] = [
    { name: 'Design', type: 'Judging criterion', required: true, description: 'User experience clarity, speed, and information density.', default: '—' },
    { name: 'Balanced frontend & backend', type: 'Judging criterion', required: true, description: 'A system where UI is not a shell and backend is not a black box.', default: '—' },
    { name: 'Reliability under failure', type: 'Judging criterion', required: true, description: 'When something breaks, the system should recover or explain.', default: '—' }
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="the-problem" className="text-2xl font-bold tracking-tight">The Problem</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          It is 2am and you are not debugging a bug so much as you are negotiating with the aftermath. You set up a workflow,
          it ran perfectly for two weeks, and then one morning it is broken. Not loudly. Not cleanly. You discover half‑committed
          data across three systems, one of them already emailed a customer, and there is no single place that can explain what happened.
        </p>
        <p className="text-[14px] text-text-secondary leading-7">
          The deeper problem is not bad luck. It is structural. We build automation that can execute, but cannot recover. It can
          take actions, but cannot justify them. It can observe failure, but cannot prevent the next one. The failure is baked into
          the default shape of automation: fire and forget, retry until it works, and hope your logs are enough.
        </p>
        <p className="text-[14px] text-text-secondary leading-7">
          The failure modes are painfully consistent. Silent failures leave inconsistent state. Recovery is manual, requiring
          restarts and ad‑hoc scripts. Decisions become black boxes with no audit trail. Systems stay reactive, never predicting
          degradation until it is already customer‑visible. Workflows end half‑done, with no rollback story, so the only “fix” is to
          continue forward and pray.
        </p>
        <p className="text-[14px] text-text-secondary leading-7">
          Engineers accept this because “that’s just how automation works.” That sentence is the thing that makes this worth building.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="a-different-approach" className="text-xl font-bold tracking-tight">A Different Approach</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          What if the system could think about its own failures. Not in the vague sense of “we added retries,” but in the concrete
          sense of diagnosis, strategy revision, and controlled re‑execution against a known‑good checkpoint.
        </p>
        <p className="text-[14px] text-text-secondary leading-7">
          What if low confidence in an output was caught before that output was written anywhere. What if every successful step
          created a save point so failure did not mean starting from scratch. What if every incident generated a plain English autopsy
          that could be read by the on‑call and the future engineer who will inherit the system.
        </p>
        <p className="text-[14px] text-text-secondary leading-7">
          FlowSentrix is an attempt to treat automation as an engineering system, not a collection of scripts: bounded loops, explicit
          state transitions, deterministic checkpoints, and a recovery path that is designed rather than improvised.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="what-flowsentrix-does" className="text-xl font-bold tracking-tight">What FlowSentrix Does</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            title="Confidence‑Gated Healing"
            body="Every step includes a self‑evaluated confidence score. When the score is below the configured threshold, the system treats the output as unsafe, prevents external writes, and routes the run through the Healer Agent with full context."
          />
          <FeatureCard
            title="Time Travel Rollback"
            body="After every successful step, FlowSentrix stores a snapshot of the run state and a reversible write log. When healing attempts are exhausted, it rolls back external side‑effects and replays the run from the last safe checkpoint."
          />
          <FeatureCard
            title="Live Autopsy Reports"
            body="Every incident generates a structured autopsy with timestamps, duration, original input/output, attempted strategies, and final outcome. The report is readable on the dashboard and renderable to PDF for sharing and audit."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 id="the-self-healing-loop" className="text-xl font-bold tracking-tight">The Self‑Healing Loop</h2>
        <MermaidDiagram
          chart={`flowchart TD
  A[Workflow Trigger] --> B[Orchestrator: load definition]
  B --> C[Worker Agent: execute step]
  C --> D[LLaMA Loop: tool calls]
  D --> E{Confidence >= threshold?}
  E -- yes --> F[External write + snapshot save]
  F --> G[Next step]
  E -- no --> H[HEAL_REQUIRED]
  H --> I[Healer Agent]
  I --> J{Attempts < 3?}
  J -- yes --> C
  J -- no --> K[Time Travel Rollback]
  K --> L[REPLAY_STARTED]
  L --> M{Replay succeeds?}
  M -- yes --> N[RUN_COMPLETED]
  M -- no --> O[HITL_TRIGGERED]
  O --> P[HITL_RESOLVED]
  P --> C
  N --> Q[AUTOPSY_GENERATED]`}
          caption="The complete self‑healing loop, with confidence gating, bounded attempts, rollback, replay, and HITL as the last resort."
        />
      </section>

      <section className="space-y-4">
        <h2 id="comparison" className="text-xl font-bold tracking-tight">Comparison</h2>
        <ComparisonTable headers={comparisonHeaders} rows={comparisonRows} />
      </section>

      <section className="space-y-4">
        <h2 id="competition-context" className="text-xl font-bold tracking-tight">Competition Context</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          ARIA 2025 Track 2 asks for agents that do more than execute: they must adapt, communicate, and remain legible under failure.
          That requirement is what FlowSentrix is optimized for. The demo is intentionally built around the moments that usually ruin
          a live presentation: a step fails, an integration is slow, confidence drops, or the system needs a human decision.
        </p>
        <p className="text-[14px] text-text-secondary leading-7">
          The judging criteria map cleanly to implementation details. Design is not a coat of paint; it is the ability to find the
          answer quickly while the system is under stress. Balanced frontend and backend means the UI is a window into the real state
          machine, not a spinner that hides it. Reliability is shown in the recovery path: bounded loops, explicit rollback, and HITL
          escalation with a clear resumption point.
        </p>
        <PropTable props={criteria} />
      </section>
    </div>
  );
}

