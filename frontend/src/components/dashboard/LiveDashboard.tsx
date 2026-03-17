import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StatCards } from '../dashboard/StatCards';
import { WorkflowSelector } from '../dashboard/WorkflowSelector';
import { RunTimeline } from '../dashboard/RunTimeline';
import { EventLog } from '../dashboard/EventLog';
import { RunDetailsTabs } from '../dashboard/RunDetailsTabs';
import { useSSEStream } from '../../hooks/useSSEStream';
import { CollapsibleAutopsy } from './CollapsibleAutopsy';
import { API } from '../../api/client';

export const LiveDashboard: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const runId = searchParams.get('run');
    const { runState, events } = useSSEStream(runId);
    const [historicalEvents, setHistoricalEvents] = useState<any[]>([]);

    useEffect(() => {
        if (!runId) { setHistoricalEvents([]); return; }
        API.runs.getTimeline(runId).then((data: any[]) => {
            setHistoricalEvents(data);
        }).catch(console.error);
    }, [runId]);

    const allEvents = [...historicalEvents, ...events].reduce((acc: any[], ev) => {
        const key = `${ev.type}-${ev.timestamp || ''}-${ev.stepIndex ?? ''}`;
        if (!acc.find((e: any) => `${e.type}-${e.timestamp || ''}-${e.stepIndex ?? ''}` === key)) acc.push(ev);
        return acc;
    }, []).sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    useEffect(() => {
        if (!runId) {
            // Find the most recent run overall
            API.runs.list().then(runs => {
                const sorted = runs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
                if (sorted.length > 0) {
                    setSearchParams({ run: sorted[0].id });
                }
            }).catch(console.error);
        }
    }, [runId, setSearchParams]);

    const handleWorkflowSelect = async (wfId: string) => {
        try {
            const runs = await API.runs.list();
            const filteredRuns = wfId ? runs.filter(r => r.workflow_id === wfId) : runs;
            const sorted = filteredRuns.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
            if (sorted.length > 0) {
                setSearchParams({ run: sorted[0].id });
            } else {
                setSearchParams({});
                alert(wfId ? 'No runs found for this workflow.' : 'No runs found.');
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex flex-col h-full max-h-full">
            <StatCards />
            <WorkflowSelector
                selectedId={runState?.workflowId || null}
                onSelect={handleWorkflowSelect}
            />

            <div className="flex-1 flex flex-col min-h-0 pb-4">
                <RunTimeline runState={runState} />
                {runId && <RunDetailsTabs runId={runId} allEvents={allEvents} />}
                <EventLog events={allEvents} />
                {runId && <CollapsibleAutopsy runId={runId} />}
            </div>
        </div>
    );
};
