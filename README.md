# FlowSentrix

Predict. Heal. Time Travel. Explain.

Build
Node.js
Docker
Made with LLaMA 3

FlowSentrix is a self-healing workflow engine for multi-agent automation. It predicts confidence before it writes, time-travels back when recovery is needed, and produces an autopsy so you can explain exactly what happened. When humans must decide, FlowSentrix escalates with a clean approval loop.

## Demo

FlowSentrix dashboard showing runs, healing events, and autopsy reports

Live demo is available at the deployed Railway URL: `https://airiaagent-production.up.railway.app`.

## The Problem

You set automation in motion because speed matters. Then something breaks quietly and leaves half-committed data, and your system can’t recover without manual restarts.

You try to recover, but recovery is bolted on after the failure. The system reruns the same logic, hoping luck improves, while the real cause gets buried under logs you didn’t design for human understanding.

You end up with black-box AI that can do the work but can’t explain the outcome in a way that earns trust. Without a narrative of what was inferred, what was attempted, and why it changed course, you keep firefighting.

You get purely reactive systems that only respond once the damage is already visible. Everyone just accepts it. We did not.

## How It Works

### Confidence-Gated Healing

Each agent scores its own output before it touches external systems. The 0–100 confidence scale represents how sure the agent is that the produced output is safe to commit, validate, and propagate.

FlowSentrix enforces a write gate: if the score is below the threshold, the run does not treat the output as trusted. Instead, it triggers healing with the snapshot state and the full conversation context so the system can propose a corrected strategy rather than repeating the same unsafe write.

### Time Travel Rollback

Snapshots capture the run’s state at safe points so replay is grounded in real prior context. When a recovery path is attempted, FlowSentrix uses a reversible transaction log to record how external writes can be undone.

Rollback rewinds the database to the last safe snapshot and replays from the checkpoint with the corrected strategy. Delta compression with `fast-json-patch` keeps snapshot deltas small, so time travel remains fast enough to operate during live incidents.

### Live Autopsy Reports

Autopsy generation triggers when healing makes attempts and still needs to document what happened. The report includes the failure narrative, diagnosis, strategies tried, and the final safe outcome.

LLaMA writes the prose from structured context, and Puppeteer renders the PDF from that report. The finished artifact is persisted, downloadable via API, and deliverable via email so your incident workflow stays fast and repeatable.

## Five Built-in Workflows


| Workflow                               | Description                                                                                             | Steps | Key Agents                                                                                   | Real Integrations                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Employee Onboarding                    | Extract employee details, validate compliance, generate onboarding packet, then send it                 | 6     | EmailWorker, CRMWorker, ComplianceWorker, ITWorker, DocWorker, NotifyWorker                  | Resend (email), Slack (optional via ITWorker/NotifyWorker adapters) |
| Security Fix (CVE Auto-Remediation)    | Triage a CVE, read impacted code, generate a safe patch, validate, open a PR, then notify               | 6     | TriageAgent, ContextAgent, FixAgent, ValidationAgent, PRAgent, NotifyAgent                   | GitHub (PR), Slack (security alerts)                                |
| PR Code Review                         | Fetch PR diff, scan for issues, reason about intent, and produce a structured review                    | 6     | DiffAgent, SecurityAgent, LogicAgent, StyleAgent, SummaryAgent, CommentAgent                 | GitHub (diff + review comments)                                     |
| Compliance Audit & Evidence Collection | Pull evidence, map it to frameworks, identify gaps, generate a report, and distribute                   | 6     | DataCollectionAgent, PolicyAgent, GapAgent, RemediationAgent, ReportAgent, DistributionAgent | Email via Resend (distribution), doc generation via Puppeteer       |
| Risk Flag Triage                       | Detect anomalous signals, score and correlate risk, alert the ops channel, and create follow-up tickets | 6     | MonitorWorker, AnomalyAgent, RiskScoringAgent, CorrelationAgent, AlertAgent, TicketAgent     | Slack (ops alerts), external ticketing via call_api adapter         |


## Architecture

### Frontend

The React dashboard streams execution events over SSE so you can observe state transitions as they happen. The UI surfaces confidence, healing events, and autopsy artifacts without forcing page reloads.

Because the frontend is event-driven, you can cut fast during demos: refresh once, then narrate based on the live timeline.

### Backend

Fastify hosts the REST API, SSE stream endpoints, and the workflow orchestration routes. Fastify is used because its plugin model keeps concerns separated while still making it easy to evolve the API surface safely.

The backend persists durable run state in PostgreSQL and uses Redis Pub/Sub to publish run events across agents.

### Agent System

The system is four-layered: Orchestrator manages run flow, Worker executes step logic, Monitor detects systemic failures and confidence drops, and Healer performs diagnosis plus recovery.

Each layer is designed to keep responsibilities narrow: if a step fails, you know which component observed it, why it failed, and how recovery proceeded.

### Storage

PostgreSQL stores workflow definitions, run steps, healing events, snapshots, HITL requests, and autopsy artifacts. JSONB columns keep the system flexible while preserving structure for audit and explanation.

Redis has a dual purpose: real-time event fan-out for SSE and fast snapshots/deltas for time travel.

### AI Engine

LLaMA 3 runs through Groq for fast inference, tool calling, and structured confidence evaluation. The system prioritizes predictable latency so healing can operate during live workflows.

The confidence gate and bounded retry loop prevent the AI from turning uncertainty into durable external writes.

```
Browser
  |
  |  SSE + REST
  v
Fastify Backend  -------------------->  PostgreSQL (JSONB durable state)
   |            \
   |             \-------------------->  Redis (PubSub + snapshot deltas)
   v
Orchestrator / Monitor / Worker / Healer
   |
   +----> Groq (LLaMA 3 + confidence scoring + tool calling)
   |
   +----> Tools (Slack, GitHub, Resend adapters)
```

## Quickstart

1. Clone the repo
  ```bash
   git clone https://github.com/flowsentrix/areia.git
   cd areia
  ```
2. Copy `.env.example` to `.env` and fill variables
  ```bash
   cp .env.example .env
  ```
   Required variables (fill these):
  - `GROQ_API_KEY` (real inference; leave mock mode enabled if you don’t want live calls)
  - `SLACK_BOT_TOKEN` (needed when `MOCK_SLACK=false`)
  - `SLACK_SIGNING_SECRET` (needed when you want Slack interactive signature verification)
  - `SLACK_CHANNEL_OPS_ALERTS`, `SLACK_CHANNEL_SECURITY`, `SLACK_CHANNEL_RISK`, `SLACK_CHANNEL_ONBOARDING`
  - `GITHUB_TOKEN` (needed when `MOCK_GITHUB=false`)
  - `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_DEMO_RECIPIENT` (needed when `MOCK_SMTP=false`)
   Optional variables (safe to set as you prefer):
  - `MOCK_SLACK`, `MOCK_GITHUB`, `MOCK_SMTP` (set `true` for offline mock mode)
  - `EMAIL_REDIRECT_TO` (override resend destination)
  - `API_KEY` (protects action-triggering routes if you enable it)
3. Start the stack
  ```bash
   docker compose up --build
  ```
   Verify health:
4. Open the dashboard
  - `http://localhost:5173`
5. Click New Run, enable Demo Mode, hit Execute, watch healing at step 4
  - Confirm you see `HEAL_REQUIRED` then `HEALER_ACTIVATED` in the run timeline.
  - Confirm autopsy and Slack notifications in the next steps.
6. Check Slack for the real message
  - Look in the `#ops-alerts` channel (autopsy delivery) and `#security-alerts` channel (security pipeline).

## Environment Variables

### AI


| Variable                      | Required        | Default                | Description                                        |
| ----------------------------- | --------------- | ---------------------- | -------------------------------------------------- |
| `GROQ_API_KEY`                | Yes (real mode) | —                      | Groq API key for LLaMA inference.                  |
| `GROQ_MODEL_DEFAULT`          | Optional        | `llama-3.1-8b-instant` | Default Groq model used for general reasoning.     |
| `GROQ_MODEL_HEAVY`            | Optional        | `llama-3.1-8b-instant` | Heavier model used for heavier tasks like autopsy. |
| `GROQ_MAX_TOKENS`             | Optional        | `512`                  | Max tokens per completion.                         |
| `GROQ_MAX_ITERATIONS`         | Optional        | `4`                    | Max iterations for loops that call the model.      |
| `GROQ_MAX_CONTEXT_TOKENS`     | Optional        | `3500`                 | Context window cap.                                |
| `GROQ_TOOL_RESULT_CHAR_LIMIT` | Optional        | `1200`                 | Tool result truncation.                            |
| `GROQ_SCORE_HISTORY_WINDOW`   | Optional        | `8`                    | Confidence history window size.                    |
| `GROQ_PREV_OUTPUT_CHAR_LIMIT` | Optional        | `800`                  | Previous output trimming size.                     |
| `GROQ_RETRIES`                | Optional        | `2`                    | Retry attempts for inference failures.             |


### Slack


| Variable                   | Required        | Default            | Description                                                            |
| -------------------------- | --------------- | ------------------ | ---------------------------------------------------------------------- |
| `SLACK_BOT_TOKEN`          | Yes (real mode) | —                  | Slack bot token.                                                       |
| `SLACK_SIGNING_SECRET`     | Optional        | —                  | Slack app signing secret for interactive callbacks.                    |
| `SLACK_CHANNEL_OPS_ALERTS` | Optional        | `#ops-alerts`      | Channel for autopsy and ops alerts.                                    |
| `SLACK_CHANNEL_SECURITY`   | Optional        | `#security-alerts` | Channel for security pipeline alerts.                                  |
| `SLACK_CHANNEL_RISK`       | Optional        | `#risk-alerts`     | Channel for risk alerts.                                               |
| `SLACK_CHANNEL_ONBOARDING` | Optional        | `#onboarding`      | Channel for onboarding messages.                                       |
| `MOCK_SLACK`               | Optional        | `true`             | When `true`, Slack is offline mock mode; when `false`, use real Slack. |


### GitHub


| Variable                 | Required        | Default            | Description                                                              |
| ------------------------ | --------------- | ------------------ | ------------------------------------------------------------------------ |
| `GITHUB_TOKEN`           | Yes (real mode) | —                  | GitHub token for PR creation.                                            |
| `GITHUB_DEMO_REPO_OWNER` | Optional        | —                  | Repo owner used for demo PRs.                                            |
| `GITHUB_DEMO_REPO_NAME`  | Optional        | `flowsentrix-demo` | Repo name for demo PRs.                                                  |
| `MOCK_GITHUB`            | Optional        | `true`             | When `true`, GitHub is offline mock mode; when `false`, use real GitHub. |


### Email


| Variable               | Required        | Default | Description                                                             |
| ---------------------- | --------------- | ------- | ----------------------------------------------------------------------- |
| `RESEND_API_KEY`       | Yes (real mode) | —       | Resend API key for email delivery.                                      |
| `EMAIL_FROM`           | Yes (real mode) | —       | Email sender identity.                                                  |
| `EMAIL_DEMO_RECIPIENT` | Yes (real mode) | —       | Recipient for demo autopsy and HITL email.                              |
| `MOCK_SMTP`            | Optional        | `true`  | When `true`, email is offline mock mode; when `false`, use real Resend. |
| `EMAIL_REDIRECT_TO`    | Optional        | —       | Override resend destination when set.                                   |
| `ALERT_EMAIL_TO`       | Optional        | —       | Where workflow failure emails are sent.                                 |


### Database


| Variable       | Required | Default                                                        | Description                   |
| -------------- | -------- | -------------------------------------------------------------- | ----------------------------- |
| `DATABASE_URL` | Yes      | `postgresql://flowsentrix:password@localhost:5432/flowsentrix` | PostgreSQL connection string. |
| `REDIS_URL`    | Yes      | `redis://localhost:6379`                                       | Redis connection string.      |


### App


| Variable               | Required | Default                 | Description                                                     |
| ---------------------- | -------- | ----------------------- | --------------------------------------------------------------- |
| `PORT`                 | Optional | `3000`                  | Backend port.                                                   |
| `BASE_URL`             | Optional | `http://localhost:3000` | Base used in HITL links.                                        |
| `AUTO_SEED`            | Optional | `false`                 | When `true`, seeds built-in templates and demo data on startup. |
| `RATE_LIMIT_MAX`       | Optional | `120`                   | Global request rate limit.                                      |
| `RATE_LIMIT_WINDOW_MS` | Optional | `60000`                 | Rate limit window.                                              |
| `NODE_ENV`             | Optional | `development`           | Node runtime environment.                                       |
| `API_KEY`              | Optional | empty                   | When set, action-triggering routes require `x-api-key`.         |


## API Reference

All routes are grouped below; the full interactive API documentation is available at `/docs` via Swagger UI.


| Base Path                     | What It Does                                            |
| ----------------------------- | ------------------------------------------------------- |
| `/health`                     | Health check for DB/Redis/Groq connectivity.            |
| `/api/diagnostics`            | Deep diagnostics for system components.                 |
| `/workflows`                  | List and create workflow definitions.                   |
| `/workflows/:id`              | Read, update, and delete a workflow definition.         |
| `/workflows/:id/run`          | Trigger a new run for a workflow.                       |
| `/runs`                       | List all workflow runs.                                 |
| `/runs/:runId`                | Get run details.                                        |
| `/runs/:runId/steps`          | Get step records for a run.                             |
| `/runs/:runId/healing-events` | Get healing events for a run.                           |
| `/runs/:runId/autopsy`        | Get autopsy report JSON for a run.                      |
| `/runs/:runId/autopsy/pdf`    | Download the autopsy PDF file.                          |
| `/runs/:runId/hitl`           | List HITL requests for a run.                           |
| `/hitl/pending`               | List all pending HITL requests.                         |
| `/hitl/history`               | List resolved HITL history.                             |
| `/hitl/:hitlId/approve`       | Approve a HITL request and resume execution.            |
| `/hitl/:hitlId/reject`        | Reject a HITL request and retry with instructions.      |
| `/integrations`               | Register and list integrations.                         |
| `/integrations/:id/test`      | Test an integration connection.                         |
| `/integrations/:id`           | Delete an integration.                                  |
| `/security/*`                 | Security scan and vulnerability fix workflow endpoints. |
| `/reviews/*`                  | Trigger and fetch PR review outputs.                    |
| `/compliance/*`               | Trigger compliance audits and fetch reports.            |
| `/risks/active`               | List active unacknowledged risk flags.                  |
| `/stream/runs/:runId`         | SSE stream for live execution events.                   |
| `/slack/actions`              | Slack interactive actions endpoint.                     |


## Real Integrations

### Slack

Slack is used to deliver operator-facing messages for both security pipeline alerts and ops autopsy summaries. FlowSentrix posts using the `post_slack` and `post_slack_file` adapters, with `MOCK_SLACK` controlling whether it talks to Slack or stays offline.

You need a Slack app bot token and channel configuration (`SLACK_BOT_TOKEN`, `SLACK_CHANNEL_OPS_ALERTS`, `SLACK_CHANNEL_SECURITY`, `SLACK_CHANNEL_RISK`, `SLACK_CHANNEL_ONBOARDING`). When `MOCK_SLACK=false`, messages are posted live. When `MOCK_SLACK=true`, the adapters log messages and return mock delivery results.

### GitHub

GitHub is used for the security fix pipeline to open a PR with the generated patch and then post outcomes back into the workflow timeline. FlowSentrix relies on the dual-adapter pattern: when `MOCK_GITHUB=false`, it uses the GitHub token to create real PRs.

You need `GITHUB_TOKEN` plus `GITHUB_DEMO_REPO_OWNER` and `GITHUB_DEMO_REPO_NAME`. When `MOCK_GITHUB=true`, the adapters simulate PR creation so demos remain deterministic.

### Resend

Resend powers email delivery for autopsy delivery and HITL decision prompts. FlowSentrix sends email via the Resend client and coordinates Slack messaging for interactive review where supported.

You need `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_DEMO_RECIPIENT`, plus `MOCK_SMTP=false` for real delivery. When `MOCK_SMTP=true`, the email adapter operates in offline mode.

## Demo

Have these open on screen:

First: the dashboard at `http://localhost:5173`. Second: Slack with `#security-alerts` and `#ops-alerts` visible. Third: the GitHub demo repo page ready to refresh.

Onboarding healing demo (approximate timeline):

1. 00:00–00:20: Open dashboard home, highlight confidence-gated healing and autopsy narrative.
2. 00:20–00:50: Workflows → Create Workflow → import the Healing Demo Workflow JSON and validate.
3. 00:50–01:20: New Run → select Healing Demo Workflow → paste healing payload → Execute.
4. 01:20–02:00: On the run timeline, show `HEAL_REQUIRED` then healing attempts.
5. 02:00–02:30: Show the autopsy report and confirm Slack `#ops-alerts` received the summary (and PDF upload when PDF rendering is available).
6. 02:30–02:50: Conclude by referencing docs and Swagger.

Security fix demo ending with a real GitHub PR (approximate timeline):

1. 00:20–00:50: New Run → select `security_scan_pipeline` → paste security payload → Execute.
2. 00:50–01:10: Show the event log and confirm low-confidence triggers healing behavior if it happens.
3. 01:10–01:50: Open GitHub repo, refresh, and show the PR created by the `PRAgent`.
4. 01:50–02:10: Switch to Slack and show the message in `#security-alerts` with the PR URL.
5. 02:10–02:30: Show autopsy evidence and close with docs + Swagger URLs.

## The Visual Workflow Builder

The canvas is a node-based editor where each step is an agent configured with its `agentType`, system prompt, and allowed tools. You connect steps in order to define the execution chain and the data flow between outputs and downstream inputs.

The JSON preview and validation modal let you import or export workflows as a single document. Save and register turns the workflow configuration into a durable definition the orchestrator can run.

## Custom Workflows

Custom workflows are defined as JSON configuration documents and stored as workflow definitions in PostgreSQL. The OrchestratorAgent loads the workflow JSON at runtime, resolves each step’s `agentType`, and executes it through the WorkerAgent pipeline.

For full details, see `WORKFLOW_SCHEMA.md`. A minimal three-step custom workflow looks like this:

```json
{
  "name": "Custom 3-Step Pipeline",
  "trigger": { "type": "Manual", "config": {} },
  "steps": [
    { "index": 1, "agentType": "PolicyAgent", "allowedTools": [] },
    { "index": 2, "agentType": "LogicAgent", "allowedTools": [] },
    { "index": 3, "agentType": "NotifyAgent", "allowedTools": ["post_slack"] }
  ],
  "confidence_thresholds": { "global": 85 }
}
```

## Built With

- React: dashboard UI with live streaming
- Fastify: API server and plugin-based architecture
- PostgreSQL: durable run state with JSONB flexibility
- Redis: real-time event fan-out and snapshot delta support
- Groq / LLaMA 3: structured reasoning and confidence evaluation
- Puppeteer: autopsy PDF rendering
- Slack / GitHub / Resend: dual-adapter integrations
