import type { WorkflowDefinition, WorkflowRun } from './types';
import { APIClientError } from './types';

const BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    '/api';

async function fetchWithTimeout(url: string, options: RequestInit = {}) {
    const { timeout = 8000 } = options as any;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${BASE_URL}${url}`, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);

    if (!response.ok) {
        throw new APIClientError(response.status, `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

export const API = {
    workflows: {
        list: () => fetchWithTimeout('/workflows') as Promise<WorkflowDefinition[]>,
        get: (id: string) => fetchWithTimeout(`/workflows/${id}`) as Promise<WorkflowDefinition>,
        create: (payload: any) => fetchWithTimeout('/workflows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }) as Promise<WorkflowDefinition>,
        delete: (id: string, apiKey?: string) => fetchWithTimeout(`/workflows/${id}`, {
            method: 'DELETE',
            headers: apiKey ? { 'x-api-key': apiKey } : undefined
        }),
        run: (id: string, payload: any) => fetchWithTimeout(`/workflows/${id}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }),
    },
    runs: {
        list: () => fetchWithTimeout('/runs') as Promise<WorkflowRun[]>,
        get: (id: string) => fetchWithTimeout(`/runs/${id}`) as Promise<WorkflowRun>,
        getTimeline: (id: string) => fetchWithTimeout(`/runs/${id}/timeline`),
        getSteps: (id: string) => fetchWithTimeout(`/runs/${id}/steps`) as Promise<any[]>,
        getSnapshots: (id: string) => fetchWithTimeout(`/runs/${id}/snapshots`),
        rollback: (id: string, snapId: string) => fetchWithTimeout(`/runs/${id}/rollback/${snapId}`, { method: 'POST' }),
        retry: (id: string) => fetchWithTimeout(`/runs/${id}/retry`, { method: 'POST' }),
        getHitl: (id: string) => fetchWithTimeout(`/runs/${id}/hitl`) as Promise<any[]>,
        getHealingEvents: (id: string) => fetchWithTimeout(`/runs/${id}/healing-events`) as Promise<any[]>,
        getAutopsy: (id: string) => fetchWithTimeout(`/runs/${id}/autopsy`) as Promise<any>,
    },
    hitl: {
        list: () => fetchWithTimeout('/hitl') as Promise<any[]>,
        approve: (id: string) => fetchWithTimeout(`/hitl/${id}/approve`, { method: 'POST' }),
        reject: (id: string, instructions: string) => fetchWithTimeout(`/hitl/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instructions })
        }),
        modify: (id: string, payload: any) => fetchWithTimeout(`/hitl/${id}/modify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }),
    },
    healing: {
        list: () => fetchWithTimeout('/healing') as Promise<any[]>,
    },
    autopsies: {
        list: () => fetchWithTimeout('/autopsies') as Promise<any[]>,
    },
    integrations: {
        list: () => fetchWithTimeout('/integrations') as Promise<any[]>,
        test: (id: string) => fetchWithTimeout(`/integrations/${id}/test`, { method: 'POST' }) as Promise<any>,
        create: (payload: Record<string, unknown>) => fetchWithTimeout('/integrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }) as Promise<any>,
        delete: (id: string) => fetchWithTimeout(`/integrations/${id}`, { method: 'DELETE' }) as Promise<any>,
    },
    compliance: {
        getReport: () => fetchWithTimeout('/compliance/report') as Promise<any>,
        getReports: () => fetchWithTimeout('/compliance/reports') as Promise<any[]>,
        getReportById: (id: string) => fetchWithTimeout(`/compliance/reports/${id}`) as Promise<any>,
        triggerRun: (payload: Record<string, unknown>) => fetchWithTimeout('/compliance/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }) as Promise<any>,
    },
    security: {
        listVulnerabilities: () => fetchWithTimeout('/security/vulnerabilities') as Promise<any[]>,
        getVulnerability: (id: string) => fetchWithTimeout(`/security/vulnerabilities/${id}`) as Promise<any>,
        fixVulnerability: (id: string) => fetchWithTimeout(`/security/vulnerabilities/${id}/fix`, { method: 'POST' }) as Promise<any>,
        scan: (payload: Record<string, unknown>) => fetchWithTimeout('/security/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }) as Promise<any>,
    },
    risks: {
        listActive: () => fetchWithTimeout('/risks/active') as Promise<any[]>,
        acknowledge: (id: string) => fetchWithTimeout(`/risks/${id}/acknowledge`, { method: 'POST' }) as Promise<any>,
    },
    analytics: {
        overview: () => fetchWithTimeout('/analytics/overview') as Promise<any>,
        runsByPeriod: (period: 'day' | 'week' | 'month') => fetchWithTimeout(`/analytics/runs/${period}`) as Promise<any[]>,
        healing: () => fetchWithTimeout('/analytics/healing') as Promise<any>,
        confidence: () => fetchWithTimeout('/analytics/confidence') as Promise<Array<{ bucket: string; count: number }>>,
    },
    system: {
        health: () => fetchWithTimeout('/health') as Promise<any>,
    }
};
