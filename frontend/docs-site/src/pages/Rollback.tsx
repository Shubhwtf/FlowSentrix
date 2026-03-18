import React from 'react';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';
import { CodeBlock } from '../components/docs/CodeBlock';

export function Rollback() {
  const snapshotKey = 'snapshot:workflowId:runId:stepIndex';

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="rollback" className="text-2xl font-bold tracking-tight">Time travel rollback</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          Rollback in FlowSentrix is not a shell script that runs during an outage. It is a first-class feature wired into every
          write path. Snapshots capture the full run context at each safe point. A reversible transaction log records how to
          undo every write. Together they let the healer roll the world back to just before things went wrong.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="snapshot-keys" className="text-xl font-bold tracking-tight">Snapshot keys</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          Snapshots live in Redis for speed and are mirrored to PostgreSQL for durability. Each snapshot is addressed by a key that
          encodes workflow, run, and step index so the healer can ask for “the last known good” quickly.
        </p>
        <CodeBlock code={snapshotKey} language="text" filename="Redis key format" />
      </section>

      <section className="space-y-4">
        <h2 id="delta-compression" className="text-xl font-bold tracking-tight">Delta compression</h2>
        <MermaidDiagram
          chart={`flowchart LR
  S0[Step 0 baseline snapshot] --> P1[Patch 1]
  P1 --> P2[Patch 2]
  P2 --> P3[Patch 3]
  P3 --> P4[Patch 4]
  subgraph Reconstruction
    B[Load S0] --> A1[applyPatch P1]
    A1 --> A2[applyPatch P2]
    A2 --> A3[applyPatch P3]
    A3 --> A4[applyPatch P4]
  end`}
          caption="Only step 0 stores a full snapshot. All later steps store RFC 6902 patches applied on top of the baseline."
        />
      </section>

      <section className="space-y-4">
        <h2 id="rollback-executor" className="text-xl font-bold tracking-tight">Rollback executor</h2>
        <MermaidDiagram
          chart={`flowchart TD
  F[Healing attempts exhausted] --> L[Load last successful snapshot]
  L --> T[Load txlog:runId:stepIndex]
  T --> R[Replay inverse operations against PostgreSQL]
  R --> E[Emit ROLLBACK_COMPLETED]
  E --> C[Reconstruct full context from snapshot]
  C --> P[Publish REPLAY_STARTED]
  P --> O[Orchestrator resumes run]`}
          caption="Rollback is always paired with replay so the system can prove that the corrected strategy actually works."
        />
      </section>
    </div>
  );
}

