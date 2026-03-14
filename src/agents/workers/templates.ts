export const USE_CASE_1_PIPELINE = [
    {
        index: 1,
        agentType: 'EmailWorker',
        systemPrompt: 'Extract structured fields from unstructured email content. Use tool "read_email". Return JSON output.',
        allowedTools: ['read_email']
    },
    {
        index: 2,
        agentType: 'CRMWorker',
        systemPrompt: 'Read and write to HR CRM system to create employee profile. Use "write_db".',
        allowedTools: ['write_db']
    },
    {
        index: 3,
        agentType: 'ComplianceWorker',
        systemPrompt: 'Call background check APIs. Use "call_api".',
        allowedTools: ['call_api']
    },
    {
        index: 4,
        agentType: 'ITWorker',
        systemPrompt: 'Provision accounts via APIs. Use "call_api". Expect format mismatches and fail gracefully if observed.',
        allowedTools: ['call_api']
    },
    {
        index: 5,
        agentType: 'DocWorker',
        systemPrompt: 'Call "generate_document" from structured data and output PDF.',
        allowedTools: ['generate_document']
    },
    {
        index: 6,
        agentType: 'EmailWorker',
        systemPrompt: 'Send pack to new hire. Use "post_slack".',
        allowedTools: ['post_slack']
    }
];

export const USE_CASE_2_PIPELINE = [
    { index: 1, agentType: 'TriageAgent', systemPrompt: 'Assess CVE severity.', allowedTools: ['call_api'] },
    { index: 2, agentType: 'ContextAgent', systemPrompt: 'Read vulnerable file.', allowedTools: ['read_file'] },
    { index: 3, agentType: 'FixAgent', systemPrompt: 'Generate code fix.', allowedTools: [] },
    { index: 4, agentType: 'ValidationAgent', systemPrompt: 'Run CI tests.', allowedTools: ['call_api'] },
    { index: 5, agentType: 'PRAgent', systemPrompt: 'Open PR.', allowedTools: ['open_pr'] },
    { index: 6, agentType: 'NotifyAgent', systemPrompt: 'Notify Slack.', allowedTools: ['post_slack'] },
];

export const USE_CASE_3_PIPELINE = [
    { index: 1, agentType: 'DiffAgent', systemPrompt: 'Fetch PR diff.', allowedTools: ['call_api'] },
    { index: 2, agentType: 'SecurityAgent', systemPrompt: 'Scan for OWASP.', allowedTools: [] },
    { index: 3, agentType: 'LogicAgent', systemPrompt: 'Understand intent.', allowedTools: [] },
    { index: 4, agentType: 'StyleAgent', systemPrompt: 'Check styles.', allowedTools: [] },
    { index: 5, agentType: 'SummaryAgent', systemPrompt: 'Aggregate findings.', allowedTools: [] },
    { index: 6, agentType: 'CommentAgent', systemPrompt: 'Post inline comments.', allowedTools: ['call_api'] }
];

export const USE_CASE_4_PIPELINE = [
    { index: 1, agentType: 'DataCollectionAgent', systemPrompt: 'Pull logs.', allowedTools: ['query_db'] },
    { index: 2, agentType: 'PolicyAgent', systemPrompt: 'Map to frameworks.', allowedTools: [] },
    { index: 3, agentType: 'GapAgent', systemPrompt: 'Identify failing controls.', allowedTools: [] },
    { index: 4, agentType: 'RemediationAgent', systemPrompt: 'Generate remediation.', allowedTools: [] },
    { index: 5, agentType: 'ReportAgent', systemPrompt: 'Generate report.', allowedTools: ['generate_document'] },
    { index: 6, agentType: 'DistributionAgent', systemPrompt: 'Email officers.', allowedTools: ['call_api'] }
];

export const USE_CASE_5_PIPELINE = [
    { index: 1, agentType: 'MonitorWorker', systemPrompt: 'Poll events.', allowedTools: ['query_db'] },
    { index: 2, agentType: 'AnomalyAgent', systemPrompt: 'Compare signals.', allowedTools: [] },
    { index: 3, agentType: 'RiskScoringAgent', systemPrompt: 'Assign risk score.', allowedTools: [] },
    { index: 4, agentType: 'CorrelationAgent', systemPrompt: 'Group anomalies.', allowedTools: [] },
    { index: 5, agentType: 'AlertAgent', systemPrompt: 'Send alerts.', allowedTools: ['post_slack'] },
    { index: 6, agentType: 'TicketAgent', systemPrompt: 'Create tickets.', allowedTools: ['call_api'] }
];
