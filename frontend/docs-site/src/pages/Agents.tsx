import React from 'react';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';
import { AgentFlowCard } from '../components/docs/AgentFlowCard';
import { CodeBlock } from '../components/docs/CodeBlock';

export function Agents() {
  const orchestratorSignatures = `export type OrchestratorAgent = {
  listen(runId: string): Promise<void>
  executeRunLoop(runId: string): Promise<void>
  dispatchStep(runId: string, stepIndex: number): Promise<void>
}`;

  const monitorSignatures = `export type MonitorAgent = {
  listen(runId: string): Promise<void>
  onStepOutput(event: { runId: string; stepIndex: number; agentType: string; confidenceScore?: number }): Promise<void>
}`;

  const healerSignatures = `export type HealerAgent = {
  listen(runId: string): Promise<void>
  heal(params: { runId: string; stepIndex: number; agentType: string }): Promise<void>
}`;

  const workerSignatures = `export type WorkerAgent = {
  execute(params: { runId: string; stepIndex: number; agentType: string }): Promise<{ output: unknown; confidenceScore: number }>
}`;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="agents" className="text-2xl font-bold tracking-tight">Agents</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          FlowSentrix splits responsibility into four agent types with a single communication primitive: events on Redis. This keeps the
          system debuggable. You can trace a run by replaying the event stream, and you can change an agent’s behavior without inventing a new coordination protocol.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="agent-hierarchy" className="text-xl font-bold tracking-tight">Hierarchy and communication</h2>
        <MermaidDiagram
          chart={`flowchart TD
  ORCH[OrchestratorAgent] -->|dispatch| WORK[Worker Agents]
  WORK -->|STEP_OUTPUT| REDIS[(Redis bus)]
  REDIS --> MON[MonitorAgent]
  MON -->|HEAL_REQUIRED| REDIS
  REDIS --> HEAL[HealerAgent]
  HEAL -->|HEAL_SUCCEEDED| REDIS
  HEAL -->|HITL_TRIGGERED| REDIS
  REDIS --> ORCH`}
        />
      </section>

      <section className="space-y-4">
        <h2 id="core-agents" className="text-xl font-bold tracking-tight">Core agents</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgentFlowCard
            name="OrchestratorAgent"
            role="Execution coordinator"
            subscribesTo={['HEAL_SUCCEEDED', 'HITL_RESOLVED', 'STEP_COMPLETED', 'STEP_FAILED']}
            publishes={['RUN_STARTED', 'STEP_STARTED', 'RUN_COMPLETED']}
            tools={['query_db', 'publish_event']}
            description="Loads workflow definitions, dispatches steps, and advances the run when steps succeed or healing resolves."
          />
          <AgentFlowCard
            name="MonitorAgent"
            role="Event-driven validator"
            subscribesTo={['STEP_OUTPUT', 'STEP_FAILED']}
            publishes={['HEAL_REQUIRED', 'SYSTEMIC_FAILURE_DETECTED']}
            tools={['query_db', 'post_slack']}
            description="Wakes only on Redis events. Compares confidence scores to thresholds and triggers healing when outputs look unsafe or failures occur."
          />
          <AgentFlowCard
            name="HealerAgent"
            role="Diagnosis and recovery"
            subscribesTo={['HEAL_REQUIRED']}
            publishes={['HEALER_ACTIVATED', 'HEAL_ATTEMPT', 'HEAL_SUCCEEDED', 'HITL_TRIGGERED', 'AUTOPSY_GENERATED']}
            tools={['GroqClient', 'rollback', 'generate_autopsy', 'post_slack', 'send_email']}
            description="Runs a bounded diagnosis and retry loop, then escalates to rollback/replay and HITL only when automated strategies are exhausted."
          />
          <AgentFlowCard
            name="WorkerAgent"
            role="Step executor"
            subscribesTo={['STEP_STARTED']}
            publishes={['STEP_OUTPUT', 'STEP_COMPLETED', 'STEP_FAILED']}
            tools={['ToolRegistry', 'LLaMALoop']}
            description="Executes one step: prompts the model, runs tool calls, returns structured output with confidence, and persists step results."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 id="key-method-signatures" className="text-xl font-bold tracking-tight">Key method signatures</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CodeBlock code={orchestratorSignatures} language="typescript" filename="OrchestratorAgent" />
          <CodeBlock code={monitorSignatures} language="typescript" filename="MonitorAgent" />
          <CodeBlock code={healerSignatures} language="typescript" filename="HealerAgent" />
          <CodeBlock code={workerSignatures} language="typescript" filename="WorkerAgent" />
        </div>
      </section>
    </div>
  );
}

