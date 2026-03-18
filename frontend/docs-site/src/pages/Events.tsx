import React from 'react';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';
import { PropTable, type PropDefinition } from '../components/docs/PropTable';

export function Events() {
  const rows: PropDefinition[] = [
    { name: 'RUN_STARTED', type: 'Orchestrator → Redis', required: true, default: 'OrchestratorAgent', description: 'Marks the beginning of a workflow run and seeds metadata for all downstream events.' },
    { name: 'STEP_STARTED', type: 'Orchestrator → Redis', required: true, default: 'WorkerAgent', description: 'Emitted whenever a worker picks up a step so the UI and Monitor can follow progress.' },
    { name: 'STEP_OUTPUT', type: 'WorkerAgent → Redis', required: true, default: 'MonitorAgent', description: 'Carries the structured LLaMA output, confidence score, and tool results for a step.' },
    { name: 'HEAL_REQUIRED', type: 'MonitorAgent → Redis', required: true, default: 'HealerAgent', description: 'Signals that either confidence is too low or a hard failure occurred and healing must start.' },
    { name: 'HEAL_SUCCEEDED', type: 'HealerAgent → Redis', required: true, default: 'OrchestratorAgent', description: 'Tells the orchestrator that a previously failing step has a safe replacement output.' },
    { name: 'HITL_TRIGGERED', type: 'HealerAgent → Redis', required: true, default: 'OrchestratorAgent', description: 'Marks that a human approval surface was created and the run is waiting on a decision.' },
    { name: 'HITL_RESOLVED', type: 'Fastify Server → Redis', required: true, default: 'OrchestratorAgent', description: 'Carries the human decision payload so the orchestrator can resume from the checkpoint.' },
    { name: 'ROLLBACK_COMPLETED', type: 'HealerAgent → Redis', required: true, default: 'OrchestratorAgent', description: 'Confirms that database and snapshot state were rewound to the last safe point.' },
    { name: 'REPLAY_STARTED', type: 'HealerAgent → Redis', required: true, default: 'OrchestratorAgent', description: 'Notifies that a replay from a snapshot is now in progress under a corrected strategy.' }
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="events" className="text-2xl font-bold tracking-tight">Event bus</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          FlowSentrix lives on a Redis pub/sub bus. Every meaningful state transition is represented as an event with a stable name,
          a typed payload, and a clear publisher and consumer. This makes the system observable by default and keeps cross-agent
          coordination loosely coupled.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="event-flow" className="text-xl font-bold tracking-tight">End-to-end flow</h2>
        <MermaidDiagram
          chart={`sequenceDiagram
  participant O as Orchestrator
  participant W as Worker
  participant M as Monitor
  participant H as Healer
  participant F as Fastify
  participant R as Redis

  O->>R: RUN_STARTED
  O->>R: STEP_STARTED
  W->>R: STEP_OUTPUT
  M->>R: HEAL_REQUIRED
  H->>R: HEAL_ATTEMPT
  H->>R: HEAL_SUCCEEDED
  H->>R: HITL_TRIGGERED
  F->>R: HITL_RESOLVED
  H->>R: ROLLBACK_COMPLETED
  H->>R: REPLAY_STARTED
  O->>R: RUN_COMPLETED`}
          caption="The event bus turns the system into a set of collaborating processes instead of one monolithic executor."
        />
      </section>

      <section className="space-y-4">
        <h2 id="catalog" className="text-xl font-bold tracking-tight">Event catalog</h2>
        <PropTable props={rows} />
      </section>
    </div>
  );
}

