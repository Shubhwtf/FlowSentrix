import React from 'react';
import { Callout } from '../components/docs/Callout';
import { CodeBlock } from '../components/docs/CodeBlock';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';

export function Healing() {
  const confidenceSchema = `{
  "confidenceScore": 0,
  "reasoning": "string",
  "signals": ["string"],
  "risks": ["string"]
}`;

  const snapshotKey = `snapshot:{runId}:{stepIndex}`;
  const txlogKey = `txlog:{runId}:{stepIndex}`;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="healing" className="text-2xl font-bold tracking-tight">Healing</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          Retries are not healing. They are repetition. Healing starts when the system treats failure as information: diagnose the cause,
          change the strategy, and re-execute against a controlled checkpoint so you do not compound side-effects.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="confidence-scoring" className="text-xl font-bold tracking-tight">Confidence scoring</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          Every step returns output plus a self-evaluated confidence score. In practice, scores below 50 mean fundamental uncertainty,
          50–75 is borderline, 75–90 is confident, and above 90 is highly certain. Thresholds are configurable per workflow and can be overridden per step.
        </p>
        <CodeBlock code={confidenceSchema} language="json" filename="Embedded confidence JSON" />
        <MermaidDiagram
          chart={`flowchart TD
  A[LLaMA final answer] --> B[Parse confidence JSON]
  B --> C{Score >= threshold?}
  C -- yes --> D[write_db allowed]
  D --> E[Snapshot saved]
  C -- no --> F[ConfidenceBelowThresholdError]
  F --> G[WorkerAgent publishes HEAL_REQUIRED]`}
          caption="Confidence write-gating prevents unsafe writes when the model is uncertain."
        />
      </section>

      <section className="space-y-4">
        <h2 id="proactive-vs-reactive" className="text-xl font-bold tracking-tight">Proactive vs reactive healing</h2>
        <Callout type="info" title="Proactive vs reactive">
          Proactive healing happens before any external write: low confidence means the output is treated as unsafe. Reactive healing happens after a real exception:
          network timeouts, malformed responses, rate limits, or unexpected formats. Both paths converge into the same bounded healing system.
        </Callout>
        <MermaidDiagram
          chart={`flowchart LR
  A[Low confidence] -->|Proactive| H[HEAL_REQUIRED]
  B[Exception] -->|Reactive| H
  H --> I[HealerAgent]
  I --> J{Attempts < 3?}
  J -- yes --> K[Retry with revised strategy]
  J -- no --> L[Rollback + Replay]
  L --> M{Replay ok?}
  M -- no --> N[HITL_TRIGGERED]
  M -- yes --> O[Continue run]`}
        />
      </section>

      <section className="space-y-4">
        <h2 id="time-travel-rollback" className="text-xl font-bold tracking-tight">Time travel rollback</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          Rollback relies on two records: snapshots and a reversible transaction log. Snapshots capture the run state at safe points. The transaction log captures
          inverse operations for each write so rollback can reverse side-effects deterministically.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CodeBlock code={snapshotKey} language="text" filename="Redis snapshot key format" />
          <CodeBlock code={txlogKey} language="text" filename="Redis transaction log key format" />
        </div>
        <MermaidDiagram
          chart={`sequenceDiagram
  participant H as HealerAgent
  participant R as Redis
  participant P as PostgreSQL
  H->>R: load snapshot baseline + deltas
  H->>R: load txlog inverse ops
  H->>P: execute inverse ops in reverse order
  H->>R: publish ROLLBACK_COMPLETED
  H->>R: publish REPLAY_STARTED`}
          caption="Rollback is a deterministic executor, not a best-effort cleanup script."
        />
      </section>

      <section className="space-y-4">
        <h2 id="hitl" className="text-xl font-bold tracking-tight">Human-in-the-loop</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          HITL is not the default. It is the last resort when automated strategies are exhausted. The key design is resumability:
          HITL decisions publish HITL_RESOLVED and the Orchestrator resumes from a checkpoint with the decision merged into context.
        </p>
        <MermaidDiagram
          chart={`sequenceDiagram
  participant H as HealerAgent
  participant S as Slack/Email
  participant F as Fastify
  participant R as Redis
  participant O as Orchestrator
  H->>R: generate_hitl_token (TTL 24h)
  H->>S: send HITL briefing
  H->>R: publish HITL_TRIGGERED
  S->>F: Human opens /hitl/:token
  F->>R: validate + invalidate token
  F->>R: publish HITL_RESOLVED
  R->>O: Orchestrator resumes`}
        />
      </section>
    </div>
  );
}

