import React from 'react';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';

export function StateMachine() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="state-machine" className="text-2xl font-bold tracking-tight">Run state machine</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          Every workflow run in FlowSentrix moves through a finite set of states. These states are shared across agents so that
          the orchestrator, workers, healer, and UI all reason about the same lifecycle. The state machine is intentionally small,
          but the transitions are rich enough to model self-healing, rollback, replay, and HITL pauses.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="lifecycle" className="text-xl font-bold tracking-tight">Lifecycle</h2>
        <MermaidDiagram
          chart={`stateDiagram-v2
  [*] --> IDLE
  IDLE --> INITIALIZING
  INITIALIZING --> RUNNING
  RUNNING --> SCORING
  SCORING --> SUCCEEDED
  SCORING --> HEALING
  HEALING --> RUNNING: retry
  HEALING --> ROLLED_BACK: attempts exhausted
  ROLLED_BACK --> RUNNING: replay
  ROLLED_BACK --> AWAITING_HITL: replay failed
  AWAITING_HITL --> RUNNING: HITL_RESOLVED
  AWAITING_HITL --> FAILED: timeout or reject
  SUCCEEDED --> [*]
  FAILED --> [*]`}
          caption="The core idea: failures never skip straight to FAILED without giving healing, rollback, and humans a chance to intervene."
        />
      </section>
    </div>
  );
}

