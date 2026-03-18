import React, { useMemo, useState } from 'react';
import { CodeBlock } from '../components/docs/CodeBlock';
import { PropTable, type PropDefinition } from '../components/docs/PropTable';

type RouteRow = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  params?: PropDefinition[];
  body?: PropDefinition[];
  response?: PropDefinition[];
  curl: string;
  exampleJson: string;
};

function RouteTable({ title, rows }: { title: string; rows: RouteRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="bg-surface border border-border rounded-md overflow-hidden">
      <div className="px-4 py-3 bg-surface-elevated border-b border-border">
        <h3 className="text-[14px] font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-border-subtle">
        {rows.map((r) => {
          const key = `${r.method} ${r.path}`;
          const expanded = open === key;
          return (
            <div key={key}>
              <button
                onClick={() => setOpen((prev) => (prev === key ? null : key))}
                className="w-full px-4 py-3 text-left hover:bg-surface-elevated"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] px-2 py-1 border border-border rounded-md bg-background">{r.method}</span>
                    <span className="font-mono text-[12px] text-text-primary truncate">{r.path}</span>
                  </div>
                  <span className="text-[13px] text-text-secondary">{r.description}</span>
                </div>
              </button>
              {expanded && (
                <div className="px-4 pb-4 space-y-4">
                  {r.params && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted mb-2">Params</div>
                      <PropTable props={r.params} />
                    </div>
                  )}
                  {r.body && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted mb-2">Body</div>
                      <PropTable props={r.body} />
                    </div>
                  )}
                  {r.response && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted mb-2">Response</div>
                      <PropTable props={r.response} />
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <CodeBlock code={r.curl} language="bash" filename="curl" />
                    <CodeBlock code={r.exampleJson} language="json" filename="Example response" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Api() {
  const authSnippet = `curl -H "x-api-key: <your-key>" http://localhost:3000/api/workflows`;
  const swaggerSnippet = `Swagger UI (backend): http://localhost:3000/docs

Docs site (this app, when served by the backend): http://localhost:3000/docs/`;

  const routeGroups = useMemo(() => {
    const workflowRows: RouteRow[] = [
      {
        method: 'GET',
        path: '/api/workflows',
        description: 'List workflow definitions.',
        curl: 'curl http://localhost:3000/api/workflows',
        exampleJson: '[{ "id":"...", "name":"Employee Onboarding", "steps":[...] }]'
      },
      {
        method: 'POST',
        path: '/api/workflows',
        description: 'Create a workflow (use dryRun to validate).',
        body: [{ name: 'dryRun', type: 'boolean', required: false, default: 'false', description: 'When true, validates only.' }],
        curl: 'curl -X POST http://localhost:3000/api/workflows -H "Content-Type: application/json" -d \'{"name":"Demo","trigger":{"type":"Manual","config":{}},"steps":[],"confidence_thresholds":{"global":90},"dryRun":true}\'',
        exampleJson: '{ "ok": true }'
      }
    ];

    const sseRows: RouteRow[] = [
      {
        method: 'GET',
        path: '/api/stream/runs/:runId',
        description: 'Server-sent events stream for a run.',
        params: [{ name: 'runId', type: 'string', required: true, description: 'Workflow run id.', default: '—' }],
        curl: 'curl -N http://localhost:3000/api/stream/runs/<runId>',
        exampleJson: 'event: STEP_OUTPUT\ndata: {"agentType":"EmailWorker","confidenceScore":92,"output":{...}}\n'
      }
    ];

    return [
      { title: 'Workflow Management', rows: workflowRows },
      { title: 'Streaming and System', rows: sseRows }
    ];
  }, []);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 id="api" className="text-2xl font-bold tracking-tight">API</h1>
        <p className="text-[14px] text-text-secondary leading-7">
          The API is intentionally boring: REST over HTTPS with Fastify schema validation on every route. The dashboard consumes it
          for list/detail pages and uses SSE for the live event stream.
        </p>
      </section>

      <section className="space-y-4">
        <h2 id="swagger-ui" className="text-xl font-bold tracking-tight">Swagger UI</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          The backend exposes an interactive Swagger UI so you can explore routes, schemas, and example payloads from the browser.
        </p>
        <CodeBlock code={swaggerSnippet} language="text" filename="Local URLs" />
      </section>

      <section className="space-y-4">
        <h2 id="authentication" className="text-xl font-bold tracking-tight">Authentication</h2>
        <p className="text-[14px] text-text-secondary leading-7">
          Certain routes require an API key via the <span className="font-mono">x-api-key</span> header. This keeps destructive actions
          like deleting workflows gated even in a demo environment.
        </p>
        <CodeBlock code={authSnippet} language="bash" />
      </section>

      <section className="space-y-6">
        <h2 id="route-reference" className="text-xl font-bold tracking-tight">Route reference</h2>
        <div className="space-y-4">
          {routeGroups.map((group) => (
            <RouteTable key={group.title} title={group.title} rows={group.rows} />
          ))}
        </div>
      </section>
    </div>
  );
}

