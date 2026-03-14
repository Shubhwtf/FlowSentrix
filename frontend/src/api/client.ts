import type { WorkflowDefinition, WorkflowRun } from './types';
import { APIClientError } from './types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
        getSnapshots: (id: string) => fetchWithTimeout(`/runs/${id}/snapshots`),
        rollback: (id: string, snapId: string) => fetchWithTimeout(`/runs/${id}/rollback/${snapId}`, { method: 'POST' }),
        retry: (id: string) => fetchWithTimeout(`/runs/${id}/retry`, { method: 'POST' }),
    },
    hitl: {
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
    }
};
