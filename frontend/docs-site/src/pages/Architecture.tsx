import React from 'react';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';
import { CodeBlock } from '../components/docs/CodeBlock';
import { PropTable, type PropDefinition } from '../components/docs/PropTable';

export function Architecture() {
  const contextInterface = `export type RunContext = {
  workflowId: string
  runId: string
  stepIndex: number
  previousOutputs: Record<string, unknown>
  snapshotId?: string
  confidenceHistory: Array<{ stepIndex: number; agentType: string; score: number; at: string }>
  llmConversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  triggerPayload: Record<string, unknown>
}`;

  const stackRows: PropDefinition[] = [
    { name: 'Frontend', type: 'React + Vite', required: true, default: '—', description: 'Fast iteration speed and a UI that can stream events and render autopsies without reloading.' },
    { name: 'Backend', type: 'Fastify', required: true, default: '—', description: 'Performance under load, JSON schema discipline, and clean SSE support without custom plumbing.' },
    { name: 'Database', type: 'PostgreSQL + JSONB', required: true, default: '—', description: 'Relational integrity for runs/steps plus flexible payload storage for agent outputs and autopsy JSON.' },
    { name: 'Event bus', type: 'Redis Pub/Sub', required: true, default: '—', description: 'Low-latency agent coordination and a natural substrate for streaming events to SSE.' },
    { name: 'Snapshots', type: 'Redis keys', required: true, default: '—', description: 'Fast reads for rollback/replay without waiting for disk during a healing SLA.' },
    { name: 'Inference', type: 'Groq + LLaMA', required: true, default: '—', description: 'Sub-second to low-second completions so healing is fast enough to be seen live.' }
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="architecture" className="text-2xl font-bold tracking-tight">Architecture</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          FlowSentrix is designed around one constraint: failure is normal, so the architecture must make recovery cheap. That means
          an event-driven core, a durable run record, and a snapshot system that makes rollback a first-class operation rather than an emergency script.
        </p>
        <p className="text-[14px] text-text-secondary leading-7">
          Fastify was chosen over Express because the system lives on structured payloads and streaming. JSON schema validation keeps
          tool calls and route payloads predictable. SSE is not an afterthought; it is the primary way the UI stays truthful to runtime state.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="system-overview" className="text-xl font-bold tracking-tight">System overview</h2>
        <MermaidDiagram
          chart={`flowchart LR
  FE[React Dashboard + Docs] -->|REST| API[Fastify Backend]
  FE -->|SSE| SSE[Fastify SSE]
  API --> PG[(PostgreSQL)]
  API --> R[(Redis)]
  API --> GROQ[Groq API]
  API --> SLACK[Slack]
  API --> GH[GitHub]
  API --> RESEND[Resend]
  R -->|pub/sub| ORCH[Orchestrator]
  R --> MON[Monitor]
  R --> HEAL[Healer]
  R --> WORK[Worker Agents]`}
          caption="The system is small on purpose: one backend, one database, one event bus, and a set of agents that communicate through Redis."
        />
      </section>

      <section className="space-y-4">
        <h2 id="llama-loop" className="text-xl font-bold tracking-tight">LLaMA reasoning loop</h2>
        <MermaidDiagram
          chart={`sequenceDiagram
  participant W as WorkerAgent
  participant L as LLaMALoop
  participant G as GroqClient
  participant A as Groq API
  participant T as ToolRegistry
  W->>L: execute(context, tools)
  loop max 5 iterations
    L->>G: chat(messages)
    G->>A: request(model, messages)
    A-->>G: tool_call or final
    G-->>L: response
    alt tool_call
      L->>T: executeTool(name, args)
      T-->>L: toolResult
      L->>L: append toolResult
    else final answer
      L-->>W: final output + confidence
    end
  end`}
          caption="The loop is intentionally bounded: uncontrolled tool loops are a reliability bug, not a feature."
        />
      </section>

      <section className="space-y-4">
        <h2 id="context-object" className="text-xl font-bold tracking-tight">Context object</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          The context object is the continuity mechanism across execution and healing. Without it, “retry” is blind repetition. With it,
          the system can carry forward what was tried, what failed, and what the run looked like before the incident started.
        </p>
        <CodeBlock code={contextInterface} language="typescript" />
      </section>

      <section className="space-y-4">
        <h2 id="technology-stack" className="text-xl font-bold tracking-tight">Technology stack</h2>
        <PropTable props={stackRows} />
      </section>
    </div>
  );
}

