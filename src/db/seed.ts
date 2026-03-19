import { db } from './client';

const ONBOARDING_STEPS = [
    {
        index: 1,
        agentType: 'EmailWorker',
        systemPrompt: 'Extract structured employee fields for onboarding. If Task Input contains employee fields already, return ONLY JSON {"name":string,"role":string,"email":string,"department":string,"startDate":string}. Otherwise, call read_email with {"mailboxId":"demo"} exactly once, then extract and return the same JSON.',
        allowedTools: ['read_email'],
        outputMapping: { employeeData: 'output.employeeData' }
    },
    {
        index: 2,
        agentType: 'CRMWorker',
        systemPrompt: 'Create an employee profile in the database. Use write_db. You MUST call write_db with {"sql":"INSERT INTO employees (name, role, email, department) VALUES (...)"} using the employee fields from the input. Return ONLY JSON {"employeeId":string,"status":"CREATED"}.',
        allowedTools: ['write_db'],
        inputMapping: { employee: 'previousOutputs.employeeData' },
        outputMapping: { crmRecord: 'output.crmRecord' }
    },
    {
        index: 3,
        agentType: 'ComplianceWorker',
        systemPrompt: 'Perform a demo-safe background check. Do NOT call any external APIs. Return ONLY JSON {"backgroundCheck":"PASSED","provider":"demo","referenceId":string,"checkedAt":string}.',
        allowedTools: [],
        inputMapping: { employee: 'previousOutputs.employeeData' },
        outputMapping: { complianceResult: 'output.complianceResult' }
    },
    {
        index: 4,
        agentType: 'ITWorker',
        systemPrompt: 'Provision accounts in demo mode without external APIs. Return ONLY JSON {"accounts":[{"system":"google_workspace","status":"PROVISIONED"},{"system":"slack","status":"PROVISIONED"},{"system":"github","status":"PROVISIONED"}],"provisionedAt":string}.',
        allowedTools: [],
        inputMapping: { employee: 'previousOutputs.employeeData', compliance: 'previousOutputs.complianceResult' },
        outputMapping: { provisioningResult: 'output.provisioningResult' }
    },
    {
        index: 5,
        agentType: 'DocWorker',
        systemPrompt: 'Generate an onboarding PDF. You MUST call generate_document exactly once with {"template":"employee_onboarding_packet","format":"pdf","data":{...}} where data includes the employee fields and provisioned accounts. After the tool returns, output ONLY JSON {"filename":string,"fileUrl":string}.',
        allowedTools: ['generate_document'],
        inputMapping: { employee: 'previousOutputs.employeeData', provisioning: 'previousOutputs.provisioningResult' },
        outputMapping: { documentResult: 'output.documentResult' }
    },
    {
        index: 6,
        agentType: 'EmailWorker',
        systemPrompt: 'Send the onboarding packet to the new hire via email using send_onboarding_email and then post a Slack onboarding message using post_slack. The Slack message must include the employee name and explicitly say that the employee joined. Include employee name, role, department, start date, and document URL from the input.',
        allowedTools: ['send_onboarding_email', 'post_slack'],
        inputMapping: { employee: 'previousOutputs.employeeData', document: 'previousOutputs.documentResult' },
        outputMapping: { onboardingNotification: 'output.onboardingNotification' }
    }
];

const SECURITY_FIX_STEPS = [
    {
        index: 1,
        agentType: 'TriageAgent',
        systemPrompt: 'Assess CVE severity and summarize impact. Return JSON {"severity":"LOW|MEDIUM|HIGH|CRITICAL","summary":string,"shouldFix":boolean,"affectedSystem":string}.',
        allowedTools: [],
        outputMapping: { triageResult: 'output.triageResult' }
    },
    {
        index: 2,
        agentType: 'ContextAgent',
        systemPrompt: 'You MUST call read_file exactly once to fetch the affected file from GitHub. Input provides repo_owner, repo_name, affected_file. After the tool returns, output ONLY JSON {"repo":string,"owner":string,"filePath":string,"sha":string,"content":string}.',
        allowedTools: ['read_file'],
        inputMapping: { triage: 'previousOutputs.triageResult' },
        outputMapping: { codeContext: 'output.codeContext' }
    },
    {
        index: 3,
        agentType: 'FixAgent',
        systemPrompt: 'Generate a safe minimal patch for the file content to remediate the issue. Input contains JSON from ContextAgent. Output ONLY JSON {"repo":string,"filePath":string,"fileSha":string,"originalContent":string,"patchedContent":string,"title":string,"body":string,"commitMessage":string}.',
        allowedTools: [],
        inputMapping: { context: 'previousOutputs.codeContext', triage: 'previousOutputs.triageResult' },
        outputMapping: { patchResult: 'output.patchResult' }
    },
    {
        index: 4,
        agentType: 'ValidationAgent',
        systemPrompt: 'Validate the patch logically. Check that it addresses the vulnerability without breaking the surrounding code. Output ONLY JSON {"ok":boolean,"notes":string,"coverageScore":number}.',
        allowedTools: [],
        inputMapping: { patch: 'previousOutputs.patchResult' },
        outputMapping: { validationResult: 'output.validationResult' }
    },
    {
        index: 5,
        agentType: 'PRAgent',
        systemPrompt: 'You MUST call open_pr exactly once. Input contains JSON from FixAgent. Call open_pr with {repo,filePath,fileContent,fileSha,title,body,commitMessage}. After tool returns, output ONLY JSON {"prUrl":string,"prNumber":number,"branchName":string}.',
        allowedTools: ['open_pr'],
        hitlGate: true,
        inputMapping: { patch: 'previousOutputs.patchResult', validation: 'previousOutputs.validationResult' },
        outputMapping: { prResult: 'output.prResult' }
    },
    {
        index: 6,
        agentType: 'NotifyAgent',
        systemPrompt: 'Post the PR URL to Slack security channel. Input contains JSON from PRAgent. You MUST call post_slack. Message must include prUrl, severity, and a brief fix summary.',
        allowedTools: ['post_slack'],
        inputMapping: { pr: 'previousOutputs.prResult', triage: 'previousOutputs.triageResult' }
    }
];

const CODE_REVIEW_STEPS = [
    {
        index: 1,
        agentType: 'DiffAgent',
        systemPrompt: 'Fetch the PR diff using read_pr_diff. Input provides prUrl and repo. You MUST call read_pr_diff exactly once. Return ONLY JSON {"diff":string,"filesChanged":number,"additions":number,"deletions":number,"prTitle":string}.',
        allowedTools: ['read_pr_diff'],
        outputMapping: { diffResult: 'output.diffResult' }
    },
    {
        index: 2,
        agentType: 'SecurityAgent',
        systemPrompt: 'Scan the PR diff for OWASP vulnerabilities, injection risks, and exposed secrets. Return ONLY JSON {"issues":Array<{"severity":"LOW|MEDIUM|HIGH|CRITICAL","description":string,"line":number}>,"securityScore":number}.',
        allowedTools: [],
        inputMapping: { diff: 'previousOutputs.diffResult' },
        outputMapping: { securityResult: 'output.securityResult' }
    },
    {
        index: 3,
        agentType: 'LogicAgent',
        systemPrompt: 'Review the code logic for correctness, edge cases, and unhandled errors. Return ONLY JSON {"issues":Array<{"type":string,"description":string,"suggestion":string}>,"logicScore":number}.',
        allowedTools: [],
        inputMapping: { diff: 'previousOutputs.diffResult' },
        outputMapping: { logicResult: 'output.logicResult' }
    },
    {
        index: 4,
        agentType: 'StyleAgent',
        systemPrompt: 'Check code style, naming conventions, and maintainability. Return ONLY JSON {"issues":Array<{"rule":string,"description":string}>,"styleScore":number}.',
        allowedTools: [],
        inputMapping: { diff: 'previousOutputs.diffResult' },
        outputMapping: { styleResult: 'output.styleResult' }
    },
    {
        index: 5,
        agentType: 'SummaryAgent',
        systemPrompt: 'Aggregate all findings from security, logic, and style analyses into a comprehensive review summary. Return ONLY JSON {"summary":string,"overallScore":number,"recommendation":"APPROVE|REQUEST_CHANGES|REJECT","topIssues":Array<string>}.',
        allowedTools: [],
        inputMapping: { security: 'previousOutputs.securityResult', logic: 'previousOutputs.logicResult', style: 'previousOutputs.styleResult' },
        outputMapping: { reviewSummary: 'output.reviewSummary' }
    },
    {
        index: 6,
        agentType: 'CommentAgent',
        systemPrompt: 'Post inline review comments to the PR using post_review_comment. Use the aggregated summary and issues list. You MUST call post_review_comment at least once.',
        allowedTools: ['post_review_comment'],
        inputMapping: { summary: 'previousOutputs.reviewSummary', diff: 'previousOutputs.diffResult' }
    }
];

const COMPLIANCE_STEPS = [
    {
        index: 1,
        agentType: 'DataCollectionAgent',
        systemPrompt: 'Pull audit logs and evidence records from the database for the specified compliance framework. Use query_db. Return ONLY JSON {"framework":string,"evidenceCount":number,"rawRecords":Array<object>,"collectedAt":string}.',
        allowedTools: ['query_db'],
        outputMapping: { evidenceData: 'output.evidenceData' }
    },
    {
        index: 2,
        agentType: 'PolicyAgent',
        systemPrompt: 'Map the collected evidence to the compliance framework controls. Return ONLY JSON {"framework":string,"controlsMapped":number,"controlResults":Array<{"controlId":string,"status":"PASS|FAIL|PARTIAL","evidence":string}>}.',
        allowedTools: [],
        inputMapping: { evidence: 'previousOutputs.evidenceData' },
        outputMapping: { controlMapping: 'output.controlMapping' }
    },
    {
        index: 3,
        agentType: 'GapAgent',
        systemPrompt: 'Identify failing and partially-failing controls. Return ONLY JSON {"gapsFound":number,"gaps":Array<{"controlId":string,"description":string,"severity":"LOW|MEDIUM|HIGH","effort":"LOW|MEDIUM|HIGH"}>}.',
        allowedTools: [],
        inputMapping: { controls: 'previousOutputs.controlMapping' },
        outputMapping: { gapAnalysis: 'output.gapAnalysis' }
    },
    {
        index: 4,
        agentType: 'RemediationAgent',
        systemPrompt: 'Generate a prioritized remediation plan for each identified gap. Return ONLY JSON {"remediationPlan":Array<{"controlId":string,"action":string,"owner":string,"deadline":string,"priority":"P1|P2|P3"}>}.',
        allowedTools: [],
        inputMapping: { gaps: 'previousOutputs.gapAnalysis', controls: 'previousOutputs.controlMapping' },
        outputMapping: { remediationPlan: 'output.remediationPlan' }
    },
    {
        index: 5,
        agentType: 'ReportAgent',
        systemPrompt: 'Generate the compliance audit report PDF. You MUST call generate_document with {"template":"compliance_report","format":"pdf","data":{...}}. Return ONLY JSON {"filename":string,"fileUrl":string,"pageCount":number}.',
        allowedTools: ['generate_document'],
        inputMapping: { controls: 'previousOutputs.controlMapping', gaps: 'previousOutputs.gapAnalysis', remediation: 'previousOutputs.remediationPlan' },
        outputMapping: { reportDocument: 'output.reportDocument' }
    },
    {
        index: 6,
        agentType: 'DistributionAgent',
        systemPrompt: 'Distribute the compliance report to compliance officers via email and Slack. Use call_api to send the report. Return ONLY JSON {"distributed":true,"recipients":Array<string>,"deliveredAt":string}.',
        allowedTools: ['call_api'],
        inputMapping: { report: 'previousOutputs.reportDocument' }
    }
];

const RISK_MONITORING_STEPS = [
    {
        index: 1,
        agentType: 'MonitorWorker',
        systemPrompt: 'Poll the database for anomalous signals from the last 24 hours. Use query_db. Return ONLY JSON {"signals":Array<{"source":string,"value":number,"baseline":number,"deviation":number}>,"signalCount":number,"polledAt":string}.',
        allowedTools: ['query_db'],
        outputMapping: { signalData: 'output.signalData' }
    },
    {
        index: 2,
        agentType: 'AnomalyAgent',
        systemPrompt: 'Compare current signals against the historical baseline to identify anomalies. Return ONLY JSON {"anomalies":Array<{"source":string,"type":string,"severity":"LOW|MEDIUM|HIGH","deviationPercent":number}>,"anomalyCount":number}.',
        allowedTools: [],
        inputMapping: { signals: 'previousOutputs.signalData' },
        outputMapping: { anomalyResult: 'output.anomalyResult' }
    },
    {
        index: 3,
        agentType: 'RiskScoringAgent',
        systemPrompt: 'Assign a numeric risk score (0-10) to each anomaly based on severity, deviation, and business impact. Return ONLY JSON {"scoredAnomalies":Array<{"source":string,"riskScore":number,"factors":Array<string>}>,"maxRiskScore":number}.',
        allowedTools: [],
        inputMapping: { anomalies: 'previousOutputs.anomalyResult' },
        outputMapping: { riskScores: 'output.riskScores' }
    },
    {
        index: 4,
        agentType: 'CorrelationAgent',
        systemPrompt: 'Group related anomalies into correlation clusters to identify systemic threats. Return ONLY JSON {"clusters":Array<{"groupId":string,"relatedSources":Array<string>,"combinedRisk":number,"narrative":string}>}.',
        allowedTools: [],
        inputMapping: { scores: 'previousOutputs.riskScores', anomalies: 'previousOutputs.anomalyResult' },
        outputMapping: { correlationResult: 'output.correlationResult' }
    },
    {
        index: 5,
        agentType: 'AlertAgent',
        systemPrompt: 'Send risk flag alerts to the Slack risk channel for any anomaly with riskScore >= 6. You MUST call post_slack for each high-risk cluster. Format messages clearly with cluster ID, risk score, and narrative.',
        allowedTools: ['post_slack'],
        inputMapping: { clusters: 'previousOutputs.correlationResult' },
        outputMapping: { alertResult: 'output.alertResult' }
    },
    {
        index: 6,
        agentType: 'TicketAgent',
        systemPrompt: 'Create follow-up tickets for persistent or high-impact risk clusters with combinedRisk >= 7. Use call_api to create ticket records. Return ONLY JSON {"ticketsCreated":number,"tickets":Array<{"id":string,"title":string,"priority":string}>}.',
        allowedTools: ['call_api'],
        inputMapping: { clusters: 'previousOutputs.correlationResult', alerts: 'previousOutputs.alertResult' }
    }
];

export const autoSeed = async () => {
    console.log('[Seed] Syncing workflow definitions...');

    const templates = [
        {
            id: 'employee_onboarding',
            name: 'Employee Onboarding Pipeline',
            description: 'Automates new hire onboarding across email, CRM, compliance, IT provisioning, document generation, and notification.',
            is_template: true,
            steps: JSON.stringify(ONBOARDING_STEPS),
            confidence_thresholds: JSON.stringify({ global: 75 })
        },
        {
            id: 'security_scan_pipeline',
            name: 'Security Fix Pipeline',
            description: 'Triages CVE alerts, reads vulnerable code, generates patches, validates via CI, opens GitHub PRs, and notifies the security team.',
            is_template: true,
            steps: JSON.stringify(SECURITY_FIX_STEPS),
            confidence_thresholds: JSON.stringify({ global: 80 })
        },
        {
            id: 'code_review_pipeline',
            name: 'Intelligent Code Review Pipeline',
            description: 'Fetches PR diffs, scans for security issues, reviews logic and style, summarizes findings, and posts inline GitHub comments.',
            is_template: true,
            steps: JSON.stringify(CODE_REVIEW_STEPS),
            confidence_thresholds: JSON.stringify({ global: 78 })
        },
        {
            id: 'compliance_audit_pipeline',
            name: 'Compliance Report Generation Pipeline',
            description: 'Collects evidence, maps to SOC2/ISO27001/GDPR frameworks, identifies gaps, generates remediation plan, and distributes the PDF report.',
            is_template: true,
            steps: JSON.stringify(COMPLIANCE_STEPS),
            confidence_thresholds: JSON.stringify({ global: 80 })
        },
        {
            id: 'risk_monitoring_pipeline',
            name: 'Risk Monitoring Pipeline',
            description: 'Monitors system signals, detects anomalies, scores and correlates risks, alerts the ops channel, and creates follow-up tickets.',
            is_template: true,
            steps: JSON.stringify(RISK_MONITORING_STEPS),
            confidence_thresholds: JSON.stringify({ global: 75 })
        }
    ];

    for (const template of templates) {
        await db.insertInto('workflow_definitions')
            .values(template)
            .onConflict((oc) => oc.column('id').doUpdateSet({
                name: template.name,
                description: template.description,
                is_template: template.is_template,
                steps: template.steps,
                confidence_thresholds: template.confidence_thresholds,
                updated_at: new Date().toISOString()
            }))
            .execute();
    }

    const vulns = await db.selectFrom('vulnerabilities').selectAll().execute();
    if (vulns.length === 0) {
        console.log('[Seed] Seeding vulnerabilities...');
        const mockVulns = [];
        for (let i = 1; i <= 10; i++) {
            mockVulns.push({
                cve_id: `CVE-2024-00${i.toString().padStart(2, '0')}`,
                severity_score: 7 + (i % 3),
                repo: 'flowsentrix/core',
                file_path: `src/api/handler${i}.ts`,
                status: 'open'
            });
        }
        await db.insertInto('vulnerabilities').values(mockVulns).execute();
    }

    const risks = await db.selectFrom('risk_flags').selectAll().execute();
    if (risks.length === 0) {
        console.log('[Seed] Seeding risk flags...');
        return;
    }

    const integrations = await db.selectFrom('integrations').selectAll().execute();
    if (integrations.length === 0) {
        console.log('[Seed] Seeding integrations...');
        await db.insertInto('integrations').values([
            { name: 'GitHub', type: 'vcs', config: JSON.stringify({ org: 'flowsentrix' }), health_status: 'connected', last_tested_at: new Date() },
            { name: 'Slack', type: 'communication', config: JSON.stringify({ workspace: 'flowsentrix-internal' }), health_status: 'connected', last_tested_at: new Date() },
            { name: 'Jira', type: 'ticketing', config: JSON.stringify({ host: 'jira.flowsentrix.com' }), health_status: 'connected', last_tested_at: new Date() },
            { name: 'Okta', type: 'identity', config: JSON.stringify({ domain: 'id.flowsentrix.com' }), health_status: 'connected', last_tested_at: new Date() },
        ]).execute();
    }
};
