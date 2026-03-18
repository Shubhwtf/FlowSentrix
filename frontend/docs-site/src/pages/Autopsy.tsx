import React from 'react';
import { CodeBlock } from '../components/docs/CodeBlock';

export function Autopsy() {
  const autopsyJson = `{
  "runId": "run_123",
  "workflowId": "onboarding_v1",
  "stepIndex": 3,
  "summary": "Background check API returned a malformed payload. The healer rolled back step 3 writes and replayed with a simplified strategy.",
  "whatStepWasDoing": "Collect background check results and attach them to the employee record.",
  "whatWentWrong": "The mock Background Check API responded with missing fields and an unexpected nested object.",
  "signalsObserved": [
    "LLaMA self-reported confidence 42/100",
    "JSON schema validation failed for background_check_result",
    "MonitorAgent saw three similar failures in 24h for this step"
  ],
  "strategiesTried": [
    "Retry with stricter JSON parsing and default values",
    "Request a smaller field subset from the API",
    "Bypass optional enrichment and only store core fields"
  ],
  "finalOutcome": "Third strategy succeeded. Snapshot restored consistency, and the employee record is now complete.",
  "learnedForNextTime": "Keep the external contract narrow. Add explicit validation for required background check fields."
}`;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="autopsy" className="text-2xl font-bold tracking-tight">Autopsy reports</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          Every healing attempt, whether it finally succeeds or not, becomes a story. The autopsy report is that story written in
          plain language so future engineers and future LLaMA calls have context. It explains what the step was trying to do, what
          signals suggested trouble, what was attempted, and why the final outcome is safe.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="schema" className="text-xl font-bold tracking-tight">JSON schema</h2>
        <CodeBlock code={autopsyJson} language="json" filename="Autopsy JSON shape" />
      </section>
    </div>
  );
}

