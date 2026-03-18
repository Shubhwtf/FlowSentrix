import React from 'react';
import { MermaidDiagram } from '../components/docs/MermaidDiagram';
import { ToolCard, type ToolDefinition } from '../components/docs/ToolCard';

const tools: ToolDefinition[] = [
  {
    name: 'query_db',
    description: 'Read-only SQL access for agents to fetch workflow context, run history, and compliance evidence.',
    status: 'dual',
    envFlag: 'MOCK_MODE / MOCK_DB',
    arguments: [
      { name: 'sql', type: 'string', required: true, description: 'Parameterized SQL query.', default: '—' },
      { name: 'params', type: 'unknown[]', required: false, description: 'Optional parameters array.', default: '[]' }
    ],
    returnType: `export type QueryDbResult = { rows: unknown[] }`,
    exampleCallJson: `{"tool":"query_db","args":{"sql":"select * from workflow_runs where id = $1","params":["<runId>"]}}`,
    exampleReturnJson: `{"rows":[{"id":"<runId>","status":"RUNNING","created_at":"2026-03-17T15:14:04.617Z"}]}`,
    realAdapter: { description: 'Executes SQL against PostgreSQL using the backend DB client.', apiCalls: ['PostgreSQL: SELECT via Kysely'] },
    mockAdapter: { description: 'Returns seeded demo data without any external calls.', exactReturnJson: `{"rows":[]}` }
  },
  {
    name: 'write_db',
    description: 'Mutation tool with confidence gating. Logs inverse ops before writing so rollback can reverse side-effects.',
    status: 'dual',
    envFlag: 'MOCK_MODE / MOCK_DB',
    arguments: [
      { name: 'sql', type: 'string', required: true, description: 'SQL write statement (INSERT/UPDATE/DELETE).', default: '—' }
    ],
    returnType: `export type WriteDbResult = { ok: true; rowsAffected: number }`,
    exampleCallJson: `{"tool":"write_db","args":{"sql":"insert into employees (name, role) values ('Arjun Dev','Lead Architect')"}}`,
    exampleReturnJson: `{"ok":true,"rowsAffected":1}`,
    realAdapter: { description: 'Performs the write after the confidence gate passes and stores inverse ops in Redis txlog.', apiCalls: ['Redis: txlog write', 'PostgreSQL: INSERT/UPDATE/DELETE'] },
    mockAdapter: { description: 'Pretends the write succeeded and returns deterministic rowsAffected.', exactReturnJson: `{"ok":true,"rowsAffected":1}` }
  }
];

export function Tools() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="tools" className="text-2xl font-bold tracking-tight">Tools</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          Tools are the boundary between model intent and real-world side effects. The Tool Registry enforces schemas, selects adapters
          (real or mock) by environment flags, and applies the confidence write-gate for mutations.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="dual-adapter-pattern" className="text-xl font-bold tracking-tight">Dual-adapter pattern</h2>
        <MermaidDiagram
          chart={`flowchart TD
  A[LLaMA tool_call] --> B[ToolRegistry]
  B --> C{MOCK flag?}
  C -- true --> D[MockAdapter]
  C -- false --> E[RealAdapter]
  D --> F[Tool result]
  E --> F
  B --> G{write_db?}
  G -- yes --> H{confidence gate}
  H -- pass --> E
  H -- fail --> I[ConfidenceBelowThresholdError]`}
        />
      </section>

      <section className="space-y-6">
        <h2 id="tool-reference" className="text-xl font-bold tracking-tight">Tool reference</h2>
        <div className="space-y-4">
          {tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}

