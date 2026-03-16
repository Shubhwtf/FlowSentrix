import { Generated, ColumnType } from 'kysely';

export interface WorkflowDefinitionsTable {
  id: Generated<string>;
  name: string;
  steps: unknown;
  confidence_thresholds: unknown | null;
  hitl_contacts: unknown | null;
  integration_mappings: unknown | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface WorkflowRunsTable {
  id: Generated<string>;
  workflow_id: string;
  status: string;
  trigger_payload: unknown | null;
  started_at: ColumnType<Date, string | undefined, never>;
  completed_at: Date | null;
  outcome: string | null;
}

export interface RunStepsTable {
  id: Generated<string>;
  run_id: string;
  step_index: number;
  agent_type: string;
  status: string;
  input: unknown | null;
  output: unknown | null;
  confidence_score: number | null;
  llm_conversation: unknown | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface HealingEventsTable {
  id: Generated<string>;
  run_id: string;
  step_id: string;
  event_type: string;
  llm_diagnosis: unknown | null;
  strategies_tried: unknown | null;
  outcome: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface SnapshotsTable {
  id: Generated<string>;
  run_id: string;
  step_index: number;
  state: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AutopsyReportsTable {
  id: Generated<string>;
  run_id: string;
  content_json: unknown | null;
  pdf_path: string | null;
  generated_at: ColumnType<Date, string | undefined, never>;
}

export interface HitlRequestsTable {
  id: Generated<string>;
  run_id: string;
  step_id: string;
  llm_briefing: string | null;
  status: string;
  decided_by: string | null;
  decision: string | null;
  decided_at: Date | null;
  outcome: string | null;
}

export interface IntegrationsTable {
  id: Generated<string>;
  name: string;
  type: string;
  config: unknown | null;
  health_status: string | null;
  last_tested_at: Date | null;
}

export interface ComplianceReportsTable {
  id: Generated<string>;
  framework: string;
  run_id: string;
  content: unknown | null;
  pdf_path: string | null;
  generated_at: ColumnType<Date, string | undefined, never>;
}

export interface ComplianceControlsTable {
  id: string;
  framework: string;
  description: string;
  status: string;
  score: number;
}

export interface ComplianceGapsTable {
  id: Generated<string>;
  framework: string;
  description: string;
  action_required: string;
  effort: string;
}

export interface VulnerabilitiesTable {
  id: Generated<string>;
  cve_id: string;
  severity_score: number | null;
  repo: string | null;
  file_path: string | null;
  llm_fix: unknown | null;
  pr_url: string | null;
  status: string | null;
}

export interface RiskFlagsTable {
  id: Generated<string>;
  risk_score: number | null;
  category: string | null;
  signals: unknown | null;
  correlation_group_id: string | null;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
}

export interface AuditLogTable {
  id: Generated<string>;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor: string | null;
  payload: unknown | null;
  timestamp: ColumnType<Date, string | undefined, never>;
}

export interface Database {
  workflow_definitions: WorkflowDefinitionsTable;
  workflow_runs: WorkflowRunsTable;
  run_steps: RunStepsTable;
  healing_events: HealingEventsTable;
  snapshots: SnapshotsTable;
  autopsy_reports: AutopsyReportsTable;
  hitl_requests: HitlRequestsTable;
  integrations: IntegrationsTable;
  compliance_reports: ComplianceReportsTable;
  compliance_controls: ComplianceControlsTable;
  compliance_gaps: ComplianceGapsTable;
  vulnerabilities: VulnerabilitiesTable;
  risk_flags: RiskFlagsTable;
  audit_log: AuditLogTable;
}
