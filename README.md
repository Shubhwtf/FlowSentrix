# FlowSentrix

FlowSentrix is a resilient, event-driven workflow orchestration engine built for complex multi-agent pipelines. The system is designed around a single reality: failures happen, and automation must be able to recover, explain what went wrong, and keep runtime state consistent.

Core capabilities:

- Confidence-gated execution (writes are blocked unless output confidence passes a threshold)
- Autonomous self-healing (retry + diagnosis)
- Time-travel rollback (snapshot + reversible transaction log + replay)
- Human-in-the-loop (HITL) escalation when automated recovery is not sufficient
- Live observability (SSE event stream + autopsy reports)

## Healing Engine (how recovery actually works)

FlowSentrix is built assuming failures will happen (network issues, malformed upstream responses, LLaMA uncertainty, integration contract drift). The healing engine is the part that turns “something went wrong” into “the system can recover, explain, and continue without corrupting state”.

### 1) Confidence scoring and the write gate

After a worker agent finishes a step, the system uses LLaMA’s structured self-evaluation to attach a confidence score to the step output. This score is compared against a threshold (global by default, with per-step overrides supported). If confidence is too low, the system does not treat the output as safe to write:

- Passing confidence: the step output is allowed to persist and the run continues.
- Failing confidence: the output is treated as low-trust and healing is triggered instead of committing it.

This is the core safety property: “we never spread uncertainty into durable state”.

### 2) Proactive vs reactive healing triggers

Healing can start before things fully break:

- Proactive path: a step completes, but confidence is below threshold. Healing begins with the last known good context.
- Reactive path: the step errors (exceptions, malformed payloads, integration failures, unexpected response formats). Healing begins with error details and execution context.

Both paths converge on the same recovery machinery, so behavior is consistent and debuggable.

### 3) Diagnosis + bounded retry attempts

Healing does not just “retry blindly”. It runs a diagnosis loop first:

- The Healer agent builds a diagnosis prompt using the step description, failed output (or error), confidence history, and the LLM conversation context.
- The Healer produces a revised strategy tailored to the specific failure mode.
- The Worker agent executes the revised strategy against the snapshot state.

This loop is bounded by an attempt cap so the system does not spiral forever. If recovery fails across attempts, the system escalates.

### 4) Time-travel rollback (snapshots + reversible writes + replay)

When automated recovery cannot find a safe fix, FlowSentrix rewinds the world:

- Snapshots capture the run context at safe points (including agent outputs and external state references needed for replay).
- A reversible transaction log records how to undo each write (inverse operations are logged before writes execute).
- Rollback restores the database state back to the last safe snapshot.
- Replay then attempts the corrected strategy again from the checkpoint step.

The key benefit is correctness: rollback is automatic and mechanical, not “manual human cleanup”.

### 5) HITL escalation (last resort decisions)

If replay still cannot produce a safe outcome, the system escalates to humans:

- The Healer creates a single-use token and stores the pending decision request.
- Slack interactive actions and email deliver the decision surface.
- When a human approves/rejects/modifies, the system publishes a resolved event and the orchestrator resumes execution from the checkpoint with the human decision merged into context.

HITL is intentionally the last resort, not the default recovery mechanism.

### 6) Autopsy reports (plain-English failure narratives)

Every healing event generates an autopsy report for later review and to improve future reasoning:

- What the step was trying to do.
- What went wrong (signals observed, confidence trajectory, error details).
- What strategies were tried and what changed.
- What the final safe outcome was (or why it required escalation).

Autopsy reports are persisted and can be downloaded as PDFs and sent via email, which keeps incident response fast and repeatable.

## Repo / System Graph

```mermaid
flowchart LR
  UI[Dashboard UI] -->|REST| API[Fastify Backend]
  UI -->|SSE Events| API
  API --> PG[(PostgreSQL)]
  API --> Redis[(Redis Pub/Sub + Snapshots)]
  API --> Agents[Orchestrator / Monitor / Worker / Healer]
  Agents --> Redis
  Agents --> Groq[Groq API (LLaMA)]
  Agents --> Tools[Tool Registry + Dual Adapters]
  Tools --> Slack[Slack]
  Tools --> GitHub[GitHub]
  Tools --> Resend[Resend]
  API --> Autopsy[Autopsy Reports + PDFs]
```

## Local Development (Docker)

### Requirements

- Docker + Docker Compose
- (Optional) `GROQ_API_KEY` if you want real LLaMA inference instead of deterministic mock behavior

### Start the stack

```bash
GROQ_API_KEY=your_key_here docker compose up --build
```

Ports:

- Backend (Fastify + dashboard): `http://localhost:3000`
- PostgreSQL: `http://localhost:5432`
- Redis: `http://localhost:6379`

### Health check

```bash
curl http://localhost:3000/health
```

## Environment Variables

Copy the root environment template:

```bash
cp .env.example .env
```

Then fill in:

- `GROQ_API_KEY` (required for real inference; for demo/test runs you can keep LLM mocked)
- Slack:
  - `SLACK_BOT_TOKEN`
  - `SLACK_SIGNING_SECRET`
  - `SLACK_CHANNEL_OPS_ALERTS`, `SLACK_CHANNEL_SECURITY`, `SLACK_CHANNEL_RISK`, `SLACK_CHANNEL_ONBOARDING`
  - `MOCK_SLACK` (set `true` to use the mock Slack adapter)
- GitHub:
  - `GITHUB_TOKEN` (recommended: fine-grained token)
  - `GITHUB_DEMO_REPO_OWNER`
  - `GITHUB_DEMO_REPO_NAME`
  - `MOCK_GITHUB` (set `true` to use the mock GitHub adapter)
- Resend:
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `MOCK_SMTP` (set `true` for mock email adapter)

For the full variable list, see `.env.example`.

## API & Streaming

### SSE event stream (live dashboard updates)

```http
GET /stream/runs/:runId
```

This is the event stream the dashboard consumes to show real-time step progress, healing activity, and completion.

### API docs (Swagger UI)

Documentation:

- `http://localhost:5174/docs/`

Swagger UI:

- `http://localhost:3000/docs`


## Integrations (Slack, GitHub, Resend)

FlowSentrix uses a dual-adapter pattern for integrations:

- Each integration can run in **mock mode** or **real mode**
- Per-integration `MOCK_*` flags override global mock mode, so you can enable one integration at a time

