import { db } from './client';
import { USE_CASE_1_PIPELINE, USE_CASE_2_PIPELINE, USE_CASE_3_PIPELINE, USE_CASE_4_PIPELINE, USE_CASE_5_PIPELINE } from '../agents/workers/templates';

export const autoSeed = async () => {
    console.log('[Seed] Syncing workflow definitions...');
    const workflows = [
        { id: 'employee_onboarding', name: 'Employee Onboarding (Use Case 1)', steps: JSON.stringify(USE_CASE_1_PIPELINE), confidence_thresholds: JSON.stringify({ DocWorker: 0 }) },
        { id: 'security_scan_pipeline', name: 'Code Vulnerability Auto-Remediation (Use Case 2)', steps: JSON.stringify(USE_CASE_2_PIPELINE), confidence_thresholds: JSON.stringify({}) },
        { id: 'cloud_infra_provisioning', name: 'Cloud Infrastructure Provisioning (Use Case 3)', steps: JSON.stringify(USE_CASE_3_PIPELINE), confidence_thresholds: JSON.stringify({}) },
        { id: 'compliance_audit_pipeline', name: 'Automated Compliance & Evidence Collection (Use Case 4)', steps: JSON.stringify(USE_CASE_4_PIPELINE), confidence_thresholds: JSON.stringify({}) },
        { id: 'customer_support_triage', name: 'Customer Support Triage (Use Case 5)', steps: JSON.stringify(USE_CASE_5_PIPELINE), confidence_thresholds: JSON.stringify({}) }
    ];

    for (const wf of workflows) {
        await db.insertInto('workflow_definitions')
            .values(wf)
            .onConflict((oc) => oc.column('id').doUpdateSet({
                name: wf.name,
                steps: wf.steps,
                confidence_thresholds: wf.confidence_thresholds,
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
