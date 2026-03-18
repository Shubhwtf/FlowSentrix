export const USE_CASE_1_PIPELINE = [
    {
        index: 1,
        agentType: 'EmailWorker',
        systemPrompt: 'Extract structured employee fields for onboarding. If Task Input contains employee fields already, return ONLY JSON {"name":string,"role":string,"email":string,"department":string}. Otherwise, call read_email with {"mailboxId":"demo"} exactly once, then extract and return the same JSON.',
        allowedTools: ['read_email']
    },
    {
        index: 2,
        agentType: 'CRMWorker',
        systemPrompt: 'Create an employee profile in the database. Use only write_db. You MUST call write_db with {"sql":"INSERT INTO employees (name, role, email, department) VALUES (...)"} using the employee fields from the input. Return a short JSON summary after the write succeeds.',
        allowedTools: ['write_db']
    },
    {
        index: 3,
        agentType: 'ComplianceWorker',
        systemPrompt: 'Perform a demo-safe background check. Do NOT call any external APIs. Return ONLY JSON {"backgroundCheck":"PASSED","provider":"demo","referenceId":string}.',
        allowedTools: []
    },
    {
        index: 4,
        agentType: 'ITWorker',
        systemPrompt: 'Provision accounts in demo mode without external APIs. Return ONLY JSON {"accounts":[{"system":"google_workspace","status":"PROVISIONED"},{"system":"slack","status":"PROVISIONED"}]}.',
        allowedTools: []
    },
    {
        index: 5,
        agentType: 'DocWorker',
        systemPrompt: 'Generate an onboarding PDF. You MUST call generate_document exactly once with {"template":"employee_onboarding_packet","format":"pdf","data":{...}} where data includes the employee fields. After the tool returns, output ONLY JSON {"filename":string,"fileUrl":string}.',
        allowedTools: ['generate_document']
    },
    {
        index: 6,
        agentType: 'EmailWorker',
        systemPrompt: 'Send onboarding packet to new hire via email. Use "send_onboarding_email". Do NOT use any other tool.',
        allowedTools: ['send_onboarding_email']
    }
];

export const USE_CASE_2_PIPELINE = [
    { index: 1, agentType: 'TriageAgent', systemPrompt: 'Assess CVE severity and summarize impact. Return JSON {"severity":"LOW|MEDIUM|HIGH|CRITICAL","summary":string,"shouldFix":boolean}.', allowedTools: [] },
    { index: 2, agentType: 'ContextAgent', systemPrompt: 'You MUST call read_file exactly once to fetch the affected file from GitHub. Input provides repo_owner, repo_name, affected_file. After the tool returns, output ONLY JSON {"repo":string,"owner":string,"filePath":string,"sha":string,"content":string}.', allowedTools: ['read_file'] },
    { index: 3, agentType: 'FixAgent', systemPrompt: 'Generate a safe minimal patch for the file content to remediate the issue. Input contains JSON from ContextAgent. Output ONLY JSON {"repo":string,"filePath":string,"fileSha":string,"originalContent":string,"patchedContent":string,"title":string,"body":string,"commitMessage":string}.', allowedTools: [] },
    { index: 4, agentType: 'ValidationAgent', systemPrompt: 'Validate the patch logically. Output ONLY JSON {"ok":boolean,"notes":string}.', allowedTools: [] },
    { index: 5, agentType: 'PRAgent', systemPrompt: 'You MUST call open_pr exactly once. Input contains JSON from FixAgent. Call open_pr with {repo,filePath,fileContent, fileSha, title, body, commitMessage}. After tool returns, output ONLY JSON {"prUrl":string,"prNumber":number,"branchName":string}.', allowedTools: ['open_pr'] },
    { index: 6, agentType: 'NotifyAgent', systemPrompt: 'Post the PR URL to Slack security channel. Input contains JSON from PRAgent. You MUST call post_slack. Message must include prUrl.', allowedTools: ['post_slack'] },
];

export const USE_CASE_3_PIPELINE = [
    { index: 1, agentType: 'DiffAgent', systemPrompt: 'Fetch PR diff using read_pr_diff.', allowedTools: ['read_pr_diff'] },
    { index: 2, agentType: 'SecurityAgent', systemPrompt: 'Scan for OWASP.', allowedTools: [] },
    { index: 3, agentType: 'LogicAgent', systemPrompt: 'Understand intent.', allowedTools: [] },
    { index: 4, agentType: 'StyleAgent', systemPrompt: 'Check styles.', allowedTools: [] },
    { index: 5, agentType: 'SummaryAgent', systemPrompt: 'Aggregate findings.', allowedTools: [] },
    { index: 6, agentType: 'CommentAgent', systemPrompt: 'Post inline comments using post_review_comment.', allowedTools: ['post_review_comment'] }
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
