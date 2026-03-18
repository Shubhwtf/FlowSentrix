import React from 'react';
import { CodeBlock } from '../components/docs/CodeBlock';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';
import { PropTable, type PropDefinition } from '../components/docs/PropTable';

export function Workflows() {
  const workflowProps: PropDefinition[] = [
    { name: 'name', type: 'string', required: true, description: 'Workflow display name.', default: '—' },
    { name: 'trigger', type: '{ type: string; config: object }', required: true, description: 'How a run starts (Manual/Webhook/Schedule/etc).', default: '—' },
    { name: 'steps', type: 'Step[]', required: true, description: 'Ordered step definitions executed by agents.', default: '—' },
    { name: 'confidence_thresholds', type: 'Record<string, number>', required: true, description: 'Global + step index thresholds for confidence gating.', default: '{ global: 90 }' }
  ];

  const stepProps: PropDefinition[] = [
    { name: 'index', type: 'number', required: true, description: '1-based index in the pipeline.', default: '—' },
    { name: 'agentType', type: 'string', required: true, description: 'Which Worker agent runs this step.', default: '—' },
    { name: 'systemPrompt', type: 'string', required: false, description: 'Optional per-step system prompt override.', default: "''" },
    { name: 'allowedTools', type: 'string[]', required: false, description: 'Tool allow-list for this step.', default: '[]' },
    { name: 'confidenceThreshold', type: 'number', required: false, description: 'Step-level override that wins over workflow global.', default: 'workflow default' }
  ];

  const exampleWorkflow = `{
  "name": "Invoice Approval (demo)",
  "trigger": { "type": "Webhook", "config": { "path": "/webhooks/invoice" } },
  "steps": [
    { "index": 1, "agentType": "DataCollectionAgent", "systemPrompt": "", "allowedTools": ["query_db"], "confidenceThreshold": 80, "integrations": [], "inputMappings": [], "outputMappings": [] },
    { "index": 2, "agentType": "PolicyAgent", "systemPrompt": "", "allowedTools": [], "confidenceThreshold": 90, "integrations": [], "inputMappings": [], "outputMappings": [] },
    { "index": 3, "agentType": "NotifyWorker", "systemPrompt": "", "allowedTools": ["post_slack"], "confidenceThreshold": 85, "integrations": ["slack"], "inputMappings": [], "outputMappings": [] }
  ],
  "confidence_thresholds": { "global": 90, "0": 80, "1": 90, "2": 85 }
}`;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="workflows" className="text-2xl font-bold tracking-tight">Workflows</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          A workflow definition is an executable contract: triggers, step graph, agent types, and confidence thresholds. The backend validates it at
          <span className="font-mono"> POST /workflows</span>, and the Orchestrator uses <span className="font-mono">agentType</span> to resolve which Worker runs each step.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="workflow-schema" className="text-xl font-bold tracking-tight">Workflow schema</h2>
        <PropTable props={workflowProps} />
      </section>

      <section className="space-y-4">
        <h2 id="step-schema" className="text-xl font-bold tracking-tight">Step schema</h2>
        <PropTable props={stepProps} />
      </section>

      <section className="space-y-4">
        <h2 id="complete-example" className="text-xl font-bold tracking-tight">Complete example</h2>
        <CodeBlock code={exampleWorkflow} language="json" />
      </section>

      <section className="space-y-4">
        <h2 id="visual-builder" className="text-xl font-bold tracking-tight">Visual workflow builder</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          The builder is a reducer-driven canvas. Drag nodes to create steps, connect nodes to define dependencies, and watch the JSON preview update in real time.
          Validate sends a dry-run POST, and Save registers the definition.
        </p>
        <MermaidDiagram
          chart={`flowchart TD
  A[Drag node onto canvas] --> B[dispatch ADD_NODE]
  B --> C[Reducer updates state]
  C --> D[JSON preview recomputed]
  D --> E[Validate: POST /workflows dryRun]
  D --> F[Save: POST /workflows]
  F --> G[Close builder + refresh list]`}
        />
      </section>
    </div>
  );
}

