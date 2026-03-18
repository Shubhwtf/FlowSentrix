import React from 'react';
import { Callout } from '../components/docs/Callout';
import { StepList } from '../components/docs/StepList';
import { CodeBlock } from '../components/docs/CodeBlock';

export function Demo() {
  const onboardingEvents = `0s RUN_STARTED
0s STEP_STARTED (EmailWorker)
1s STEP_OUTPUT
2s STEP_STARTED (CRMWorker)
4s STEP_FAILED
4s HEAL_REQUIRED
5s HEALER_ACTIVATED
6s HEAL_ATTEMPT
10s HEAL_SUCCEEDED
10s AUTOPSY_GENERATED
11s RUN_COMPLETED`;

  const scenarios = [
    {
      title: 'Onboarding self-heal',
      description: 'Trigger the employee onboarding pipeline, let a step fail, then show healing, autopsy generation, and the run completing without manual intervention.'
    },
    {
      title: 'Security fix PR',
      description: 'Send a CVE webhook, show the Security pipeline generate a fix and open a pull request, then highlight auditability and HITL gating for high severity.'
    },
    {
      title: 'Code review automation',
      description: 'Point to an existing PR and show inline comments, a verdict, and the summary written back to GitHub.'
    },
    {
      title: 'Risk correlation',
      description: 'Show risk flags being grouped into correlation groups, then an alert that represents a compound risk, not a single-rule trip.'
    }
  ];

  const stepList = scenarios.map((s) => ({ title: s.title, description: s.description }));

  return (
    <div className="space-y-10">
      <Callout type="warning" title="Start early">
        Start <span className="font-mono">docker compose up</span> at least 5 minutes before presenting so databases are warm and any external adapters can initialize.
      </Callout>

      <section className="space-y-4">
        <h1 id="demo" className="text-2xl font-bold tracking-tight">Demo Guide</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          The demo is built around a simple promise: when a workflow fails, the system does not just stop. It diagnoses, retries with bounded attempts,
          rolls back when necessary, and escalates to a human only when automation is genuinely exhausted.
        </p>
      </section>

      <section className="space-y-6">
        <h2 id="scenarios" className="text-xl font-bold tracking-tight">Four scenarios</h2>
        <StepList steps={stepList} />
      </section>

      <section className="space-y-4">
        <h2 id="onboarding-timeline" className="text-xl font-bold tracking-tight">Onboarding timeline (seconds)</h2>
        <CodeBlock code={onboardingEvents} language="text" filename="Expected SSE events" />
      </section>

      <section className="space-y-4">
        <h2 id="fallbacks" className="text-xl font-bold tracking-tight">Fallbacks</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          If Groq is slow, enable <span className="font-mono">DEMO_MOCK_LLM=true</span>. If GitHub PR creation is slow, narrate the flow and keep moving.
          If SSE disconnects, wait a few seconds: the client reconnect logic will reattach and the run state remains consistent.
        </p>
      </section>
    </div>
  );
}

