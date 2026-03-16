CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  steps JSONB NOT NULL,
  confidence_thresholds JSONB,
  hitl_contacts JSONB,
  integration_mappings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflow_definitions(id),
  status TEXT NOT NULL,
  trigger_payload JSONB,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  outcome TEXT
);

CREATE TABLE IF NOT EXISTS run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES workflow_runs(id),
  step_index INTEGER NOT NULL,
  agent_type TEXT NOT NULL,
  status TEXT NOT NULL,
  input JSONB,
  output JSONB,
  confidence_score INTEGER,
  llm_conversation JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS healing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES workflow_runs(id),
  step_id UUID REFERENCES run_steps(id),
  event_type TEXT NOT NULL,
  llm_diagnosis JSONB,
  strategies_tried JSONB,
  outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES workflow_runs(id),
  step_index INTEGER NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autopsy_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES workflow_runs(id),
  content_json JSONB,
  pdf_path TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hitl_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES workflow_runs(id),
  step_id UUID REFERENCES run_steps(id),
  llm_briefing TEXT,
  status TEXT NOT NULL,
  decided_by TEXT,
  decision TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  outcome TEXT
);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB,
  health_status TEXT,
  last_tested_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework TEXT NOT NULL,
  run_id UUID REFERENCES workflow_runs(id),
  content JSONB,
  pdf_path TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_controls (
  id TEXT PRIMARY KEY,
  framework TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework TEXT NOT NULL,
  description TEXT NOT NULL,
  action_required TEXT NOT NULL,
  effort TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id TEXT NOT NULL,
  severity_score NUMERIC,
  repo TEXT,
  file_path TEXT,
  llm_fix JSONB,
  pr_url TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_score INTEGER,
  category TEXT,
  signals JSONB,
  correlation_group_id TEXT,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  payload JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
