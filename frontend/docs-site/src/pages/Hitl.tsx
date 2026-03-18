import React from 'react';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';
import { CodeBlock } from '../components/docs/CodeBlock';

export function Hitl() {
  const tokenExample = `GET /hitl/:token

Token storage:
- key: hitl:token:{token}
- value: { runId, workflowId, stepIndex, requestedAt }`;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="hitl" className="text-2xl font-bold tracking-tight">Human-in-the-loop</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          Healing should be autonomous almost all of the time, but not all of the time. For high-risk decisions FlowSentrix pauses
          the run and asks a human to weigh in. That flow is wired straight into Slack and email so the person on call can unblock
          the system in one click.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="tokens" className="text-xl font-bold tracking-tight">Single-use tokens</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          The healer never stores raw approval decisions in Redis. It stores a short-lived token that maps to a row in PostgreSQL.
          When someone opens the approval URL the server validates and burns the token, then renders the decision surface.
        </p>
        <CodeBlock code={tokenExample} language="text" filename="HITL token shape" />
      </section>

      <section className="space-y-4">
        <h2 id="flow" className="text-xl font-bold tracking-tight">End-to-end flow</h2>
        <MermaidDiagram
          chart={`sequenceDiagram
  participant H as HealerAgent
  participant R as Redis
  participant S as Slack
  participant E as Resend
  participant U as Human
  participant F as Fastify
  participant O as Orchestrator

  H->>R: HITL_TRIGGERED
  H->>S: post_slack (Block Kit with approve link)
  H->>E: send email with approval URL
  U->>F: GET /hitl/:token
  F->>R: validate token
  F-->>U: approval page
  U->>F: POST approve/reject/modify
  F->>R: publish HITL_RESOLVED
  R->>O: wake orchestrator
  O-->>O: resume from checkpoint with decision`}
          caption="HITL does not bypass the system; it feeds a structured decision back into the same state machine."
        />
      </section>
    </div>
  );
}

