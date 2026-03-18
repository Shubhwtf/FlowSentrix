export const contentBySlug: Record<string, string> = {
  introduction: 'FlowSentrix exists because automation fails quietly: inconsistent state, black box decisions, manual restarts, no rollback, no explanation. It uses confidence-gated execution, self-healing with hard caps, time travel rollback with snapshots, HITL escalation, and autopsy reports.',
  quickstart: 'Clone, configure env, run docker compose, open dashboard, trigger demo runs, observe SSE events, healing, autopsy PDFs, Slack and email notifications.',
  architecture: 'Fastify backend, PostgreSQL JSONB, Redis pub/sub and snapshots, Groq LLaMA inference, agent architecture, state machine, event bus, tooling.',
  agents: 'Orchestrator dispatches steps, WorkerAgents execute steps via LLaMALoop, Monitor validates outputs and publishes HEAL_REQUIRED, Healer retries then rollback/replay then HITL.',
  healing: 'Confidence scoring, proactive and reactive healing, attempt caps, rollback executor, replay, HITL flow, autopsy generation, systemic failure detection.',
  workflows: 'Workflow JSON schema, triggers, steps, thresholds, mappings, integrations, builder reducer, live JSON preview, validate and register, clone templates.',
  tools: 'Tool registry, schema-driven tool selection, dual adapters, mock vs real, write_db confidence gate, provision_account failure injection.',
  api: 'REST routes, auth via x-api-key, SSE stream, event types, demo triggers, integrations endpoints.',
  integrations: 'Slack interactive actions, GitHub PR creation via Octokit, Resend email templates, mock flags, MOCK_MODE precedence.',
  events: 'Redis pub/sub events, event naming, payload shapes, which agents publish and subscribe, delivery semantics.',
  'state-machine': 'Run lifecycle states, transitions between IDLE, RUNNING, SCORING, HEALING, ROLLED_BACK, AWAITING_HITL, FAILED, and how agents react.',
  rollback: 'Snapshot formats, delta compression strategy, reversible transaction logs, rollback executor and replay strategy.',
  hitl: 'Human-in-the-loop triggers, tokens, approval surfaces, Redis events, and how Orchestrator resumes runs.',
  autopsy: 'Autopsy report JSON schema, LLaMA prompts for incident write-ups, PDF rendering, delivery channels.',
  demo: 'End-to-end demo guide: onboarding healing, security PR, code review comments, risk correlation, HITL approval flow.',
  publishing: 'Share FlowSentrix with the wider community, listing text, tags, screenshots, and extension ideas.'
};

