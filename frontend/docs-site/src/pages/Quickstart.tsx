import React from 'react';
import { StepList } from '../components/docs/StepList';
import { Callout } from '../components/docs/Callout';
import { CodeBlock } from '../components/docs/CodeBlock';

export function Quickstart() {
  const envExample = `GROQ_API_KEY=""
DATABASE_URL="postgres://postgres:postgres@localhost:5432/flowsentrix"
REDIS_URL="redis://localhost:6379"
SLACK_BOT_TOKEN=""
SLACK_SIGNING_SECRET=""
GITHUB_TOKEN=""
GITHUB_DEMO_REPO_OWNER=""
GITHUB_DEMO_REPO_NAME="flowsentrix-demo"
RESEND_API_KEY=""
EMAIL_FROM="onboarding@resend.dev"
MOCK_MODE="true"
MOCK_SLACK="true"
MOCK_GITHUB="true"
MOCK_SMTP="true"
DEMO_MOCK_LLM="true"
DISABLE_HEALING_WORKFLOWS=""`;

  const envExplain = `Minimum to boot:
- DATABASE_URL
- REDIS_URL

Real inference:
- GROQ_API_KEY
- DEMO_MOCK_LLM=false

Turn on Slack:
- SLACK_BOT_TOKEN
- SLACK_SIGNING_SECRET
- MOCK_SLACK=false

Turn on GitHub:
- GITHUB_TOKEN
- GITHUB_DEMO_REPO_OWNER
- GITHUB_DEMO_REPO_NAME
- MOCK_GITHUB=false

Turn on Resend:
- RESEND_API_KEY
- EMAIL_FROM
- MOCK_SMTP=false`;

  const steps = [
    {
      title: 'Clone the repository',
      description: 'Clone the repo and install dependencies for both backend and frontend.',
      code: { language: 'bash', content: 'git clone <your-repo-url>\ncd areia\nnpm install\ncd frontend && npm install', filename: 'Shell' }
    },
    {
      title: 'Create your env file',
      description: 'Copy the template, then fill in the keys you want to run for the demo. You can start in mock mode and progressively turn on real integrations.',
      code: { language: 'bash', content: 'cp .env.example .env', filename: 'Shell' }
    },
    {
      title: 'Fill required variables',
      description:
        'Start in fully-mocked mode, then turn on real inference and real integrations one at a time. Use the reference below as a clean starting point, then follow the detailed credential steps on the Integrations page.',
      code: { language: 'bash', content: envExample, filename: '.env' }
    },
    {
      title: 'Decide your “mode” for the first run',
      description:
        'If you want a guaranteed smooth first run, keep everything mocked and only switch to real integrations when the UI and SSE stream look correct. If you want the full wow demo, turn on Groq first, then Slack, then GitHub, then Resend.',
      code: { language: 'text', content: envExplain, filename: 'Mode reference' }
    },
    {
      title: 'Boot infrastructure',
      description: 'Start PostgreSQL and Redis, then verify they are healthy. The backend depends on both, and rollback needs Redis to reconstruct snapshots quickly.',
      code: { language: 'bash', content: 'docker compose up -d\ndocker compose ps', filename: 'Shell' }
    },
    {
      title: 'Start the backend',
      description: 'Run the Fastify server in dev mode. It exposes REST routes and the SSE stream used by the dashboard.',
      code: { language: 'bash', content: 'npm run dev', filename: 'Shell' }
    },
    {
      title: 'Open the backend Swagger UI',
      description: 'Use Swagger UI to inspect route schemas and try requests from the browser.',
      code: { language: 'text', content: 'http://localhost:3000/docs', filename: 'Swagger UI' }
    },
    {
      title: 'Start the dashboard',
      description: 'Open the Vite frontend and confirm you can see auto-seeded workflow templates on first load.',
      code: { language: 'bash', content: 'cd frontend\nnpm run dev', filename: 'Shell' }
    },
    {
      title: 'Trigger your first demo run',
      description: 'Use the New Run modal to start a run. Watch the live SSE stream for STEP_STARTED, STEP_OUTPUT, and any HEAL_REQUIRED events.',
      code: { language: 'text', content: 'Open http://localhost:5173\nClick “New Run”\nSelect “Employee Onboarding”\nPaste {} as payload\nExecute', filename: 'UI' }
    },
    {
      title: 'Watch the healing sequence',
      description: 'When a step fails or confidence drops, you should see HEAL_REQUIRED → HEALER_ACTIVATED → HEAL_ATTEMPT. If the run resolves, you will see AUTOPSY_GENERATED and then RUN_COMPLETED.',
      code: { language: 'text', content: 'Expected events:\nRUN_STARTED\nSTEP_STARTED\nSTEP_OUTPUT\nHEAL_REQUIRED (on low confidence or exception)\nHEALER_ACTIVATED\nHEAL_ATTEMPT\nHEAL_SUCCEEDED or HITL_TRIGGERED\nAUTOPSY_GENERATED\nRUN_COMPLETED', filename: 'SSE stream' }
    }
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="quickstart" className="text-2xl font-bold tracking-tight">Quickstart</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          This is the shortest path from cloning the repo to watching a self-healing run in the dashboard. The goal is not to install
          everything perfectly on day one; it is to get feedback from a real run, then turn on real integrations one by one.
        </p>
      </section>

      <Callout type="warning" title="Groq API is required for real inference">
        For real LLaMA calls you need <span className="font-mono">GROQ_API_KEY</span>. Without it the system can still run in demo mode using <span className="font-mono">DEMO_MOCK_LLM=true</span>.
      </Callout>

      <Callout type="tip" title="Use DEMO_MOCK_LLM for development">
        When you are iterating on UI or workflows, set <span className="font-mono">DEMO_MOCK_LLM=true</span> so the system stays deterministic and you do not burn tokens while you change layout or templates.
      </Callout>

      <section className="space-y-6">
        <h2 id="steps" className="text-xl font-bold tracking-tight">Steps</h2>
        <StepList steps={steps} />
      </section>

      <section className="space-y-4">
        <h2 id="turning-on-real-integrations" className="text-xl font-bold tracking-tight">Turning on real integrations</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          Start with mock adapters until the stack is stable, then enable real integrations one at a time. The Integrations page includes
          step-by-step credential setup and the exact environment variables to flip each integration from mock to real.
        </p>
      </section>
    </div>
  );
}

