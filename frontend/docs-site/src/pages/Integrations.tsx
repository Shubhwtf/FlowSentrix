import React from 'react';
import { CodeBlock } from '../components/docs/CodeBlock';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';
import { SlackMessageMockup } from '../components/docs/SlackMessageMockup';
import { StepList } from '../components/docs/StepList';
import { PropTable, type PropDefinition } from '../components/docs/PropTable';
import { Callout } from '../components/docs/Callout';

export function Integrations() {
  const envFlags = `MOCK_MODE=true
MOCK_SLACK=true
MOCK_GITHUB=true
MOCK_SMTP=true`;

  const slackScopes: PropDefinition[] = [
    { name: 'chat:write', type: 'scope', required: true, default: '—', description: 'Post messages and update them after actions.' },
    { name: 'chat:write.public', type: 'scope', required: false, default: '—', description: 'Post into channels the app is not a member of (optional; prefer adding the bot to channels instead).' },
    { name: 'channels:read', type: 'scope', required: false, default: '—', description: 'List public channels (optional; only needed if you implement channel discovery).' },
    { name: 'commands', type: 'scope', required: false, default: '—', description: 'Optional, if you add slash-command triggers.' }
  ];

  const slackSetup = [
    {
      title: 'Create the Slack app',
      description:
        'Open the Slack API site, create a new app “From scratch”, pick your workspace, and name it FlowSentrix. This gives you a home for OAuth, Interactivity, and tokens.'
    },
    {
      title: 'Enable Interactivity and set the Request URL',
      description:
        'In “Interactivity & Shortcuts”, toggle Interactivity on. Set the Request URL to your backend /slack/actions. In development you must use an HTTPS tunnel (ngrok, Cloudflare tunnel) because Slack will not post to localhost.'
    },
    {
      title: 'Add bot scopes',
      description:
        'In “OAuth & Permissions”, add bot token scopes. Start with chat:write. Prefer adding the bot to the target channel instead of granting broader scopes.'
    },
    {
      title: 'Install the app to your workspace',
      description:
        'Click “Install to Workspace”. Copy the Bot User OAuth Token (starts with xoxb-) into SLACK_BOT_TOKEN.'
    },
    {
      title: 'Set the signing secret',
      description:
        'In “Basic Information”, copy the Signing Secret into SLACK_SIGNING_SECRET. The server uses it to validate action payload signatures.'
    },
    {
      title: 'Wire the env flags',
      description:
        'Set MOCK_MODE=true for safety, then flip only Slack to real by setting MOCK_SLACK=false. Restart the backend after changing env vars.'
    },
    {
      title: 'Verify end-to-end',
      description:
        'Trigger a workflow run. You should see a Slack message with run context. If an interactive action is shown, click it and confirm the message updates and the run continues.'
    }
  ];

  const slackEnv = `SLACK_BOT_TOKEN="xoxb-..."
SLACK_SIGNING_SECRET="..."
MOCK_SLACK="false"`;

  const slackActionsUrl = `Production:
- https://your-domain.example/slack/actions

Development:
- Use an HTTPS tunnel URL:
  https://<your-tunnel-domain>/slack/actions`;

  const githubSetup = [
    {
      title: 'Pick the demo repository',
      description:
        'Create or choose a single repository dedicated to the demo (for example flowsentrix-demo). Keeping one repo makes permissions explainable and reduces risk.'
    },
    {
      title: 'Create a fine-grained GitHub token',
      description:
        'In GitHub settings, create a fine-grained personal access token and scope it to only the demo repository.'
    },
    {
      title: 'Grant minimal permissions',
      description:
        'Give write permissions only where required for PR automation: creating branches, writing contents, and opening pull requests. Keep everything else read-only.'
    },
    {
      title: 'Set env variables',
      description:
        'Copy the token into GITHUB_TOKEN and set GITHUB_DEMO_REPO_OWNER and GITHUB_DEMO_REPO_NAME so the system knows where to create PRs.'
    },
    {
      title: 'Flip GitHub to real adapter',
      description:
        'Set MOCK_GITHUB=false (you can keep MOCK_MODE=true so only GitHub is real). Restart the backend.'
    },
    {
      title: 'Verify: generate a PR',
      description:
        'Trigger the security fix scenario. You should see a new branch and a PR appear in the repo. If it fails, confirm the token is repo-scoped and has the needed write permissions.'
    }
  ];

  const githubEnv = `GITHUB_TOKEN="github_pat_..."
GITHUB_DEMO_REPO_OWNER="your-org-or-username"
GITHUB_DEMO_REPO_NAME="flowsentrix-demo"
MOCK_GITHUB="false"`;

  const resendSetup = [
    {
      title: 'Create a Resend API key',
      description:
        'Create an API key in Resend and copy it into RESEND_API_KEY. This is the credential the backend uses to send emails.'
    },
    {
      title: 'Choose the sender address',
      description:
        'For demo mode you can use onboarding@resend.dev. For production, verify your own domain in Resend and use an address on that domain.'
    },
    {
      title: 'Flip email to real adapter',
      description:
        'Set MOCK_SMTP=false to send real email via Resend. Restart the backend after changing env vars.'
    },
    {
      title: 'Verify: receive an email',
      description:
        'Run a workflow that sends onboarding updates or HITL notifications and confirm you receive an email containing the correct run context and links.'
    }
  ];

  const resendEnv = `RESEND_API_KEY="re_..."
EMAIL_FROM="onboarding@resend.dev"
MOCK_SMTP="false"`;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="integrations" className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          Integrations follow a dual-adapter pattern: the system can run fully offline with mock adapters, or connect to real APIs.
          Per-integration flags override global mock mode, letting you switch one integration to “real” without changing the rest.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="environment-flags" className="text-xl font-bold tracking-tight">Environment flags</h2>
        <CodeBlock code={envFlags} language="bash" filename="Mock flag reference" />
        <MermaidDiagram
          chart={`flowchart TD
  A[Tool call] --> B{Per-integration MOCK_* set?}
  B -- yes --> C[Use per-integration flag]
  B -- no --> D[Use MOCK_MODE]
  C --> E[Real adapter or Mock adapter]
  D --> E`}
        />
      </section>

      <section className="space-y-4">
        <h2 id="slack" className="text-xl font-bold tracking-tight">Slack</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          Slack is the fastest path from incident to awareness. FlowSentrix uses rich Block Kit style messages because a failure page
          is not actionable unless it contains the run id, step context, and a next action. Interactive actions keep the decision inside the alert.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SlackMessageMockup
            title="Workflow failed"
            color="rgb(var(--destructive))"
            fields={[
              { label: 'Run', value: '86fbce27-b8c5-471d-94d2-9c64f22d5c16' },
              { label: 'Agent', value: 'CRMWorker' },
              { label: 'Step', value: '2' }
            ]}
            buttonLabel="Open autopsy"
            buttonColor="rgb(var(--surface-elevated))"
          />
          <SlackMessageMockup
            title="HITL required"
            color="rgb(var(--warning))"
            fields={[
              { label: 'Reason', value: 'Healing attempts exhausted' },
              { label: 'Action', value: 'Approve / Reject / Modify' }
            ]}
            buttonLabel="Review"
            buttonColor="rgb(var(--accent))"
          />
        </div>

        <div className="space-y-4">
          <h3 id="slack-setup" className="text-lg font-bold tracking-tight">Setup</h3>
          <StepList steps={slackSetup} />
          <h3 id="slack-actions-url" className="text-lg font-bold tracking-tight">Actions URL</h3>
          <CodeBlock code={slackActionsUrl} language="text" filename="Slack Interactivity request URL" />
          <h3 id="slack-env" className="text-lg font-bold tracking-tight">Environment</h3>
          <CodeBlock code={slackEnv} language="bash" filename=".env additions" />
          <h3 id="slack-scopes" className="text-lg font-bold tracking-tight">Required scopes</h3>
          <PropTable props={slackScopes} />
        </div>

        <MermaidDiagram
          chart={`sequenceDiagram
  participant H as HealerAgent
  participant S as Slack
  participant F as Fastify /slack/actions
  participant R as Redis
  participant O as Orchestrator
  H->>S: chat.postMessage (approve button)
  S->>F: action payload
  F->>F: verify signing secret
  F->>R: publish HITL_RESOLVED
  F->>S: chat.update (confirmed)
  R->>O: resume run`}
          caption="Interactive actions keep approvals fast and traceable."
        />
      </section>

      <section className="space-y-4">
        <h2 id="github" className="text-xl font-bold tracking-tight">GitHub</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          GitHub automation is used for security fixes and code review. FlowSentrix uses Octokit to read file content with a SHA,
          create a branch, update the file, and open a pull request. The SHA keeps the update safe against races.
        </p>
        <Callout type="tip" title="Prefer fine-grained tokens">
          Fine-grained tokens scoped to a single demo repository reduce risk and keep permissions explainable to judges.
        </Callout>
        <div className="space-y-4">
          <h3 id="github-setup" className="text-lg font-bold tracking-tight">Setup</h3>
          <StepList steps={githubSetup} />
          <h3 id="github-env" className="text-lg font-bold tracking-tight">Environment</h3>
          <CodeBlock code={githubEnv} language="bash" filename=".env additions" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 id="resend" className="text-xl font-bold tracking-tight">Resend</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          Resend is used for onboarding updates, incident alerts, and HITL requests. Email templates are inline-styled for client compatibility.
          For demo mode you can use <span className="font-mono">onboarding@resend.dev</span> without DNS configuration.
        </p>
        <div className="space-y-4">
          <h3 id="resend-setup" className="text-lg font-bold tracking-tight">Setup</h3>
          <StepList steps={resendSetup} />
          <h3 id="resend-env" className="text-lg font-bold tracking-tight">Environment</h3>
          <CodeBlock code={resendEnv} language="bash" filename=".env additions" />
        </div>
      </section>
    </div>
  );
}

