import { useState, useEffect, useReducer, useRef } from 'react';
import { runReducer } from '../store/runReducer';
import type { RunState } from '../store/types';
import { API } from '../api/client';

export const useSSEStream = (runId: string | null) => {
    const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'CLOSED'>('IDLE');
    const [events, setEvents] = useState<any[]>([]);

    const initialState: RunState = {
        id: runId || '',
        workflowId: '',
        status: 'PENDING',
        steps: {},
        healingEvents: [],
        lastUpdated: Date.now()
    };

    const [runState, dispatch] = useReducer(runReducer, initialState);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!runId) return;

        setEvents([]); // Clean slate for new runId
        let retryCount = 0;

        const initializeAndConnect = async () => {
            setStatus('CONNECTING');
            try {
                const runData = await API.runs.get(runId);
                const stepsData = await API.runs.getSteps(runId);

                const stepsObj: Record<number, any> = {};
                stepsData.forEach(s => {
                    stepsObj[s.step_index] = {
                        index: s.step_index,
                        agentType: s.agent_type,
                        status: s.status,
                        output: (() => { try { return s.output ? JSON.parse(s.output) : undefined; } catch { return s.output; } })(),
                        confidenceScore: s.confidence_score
                    };
                });

                dispatch({
                    type: 'INIT_RUN',
                    payload: {
                        workflowId: runData.workflow_id,
                        status: runData.status as any,
                        steps: stepsObj
                    }
                });
            } catch (e) {
                console.error("Failed to fetch initial run state", e);
            }

            const connect = () => {
                setStatus(retryCount === 0 ? 'CONNECTING' : 'RECONNECTING');

                const es = new EventSource(`/stream/runs/${runId}`);
                eventSourceRef.current = es;

                es.onopen = () => {
                    setStatus('LIVE');
                    retryCount = 0;
                };

                es.onmessage = (event) => {
                    try {
                        let parsed = null;
                        try { parsed = JSON.parse(event.data); } catch { parsed = { type: 'UNKNOWN', payload: event.data }; }

                        setEvents(prev => [parsed, ...prev]);

                        if (parsed.type.startsWith('STATE_')) {
                            dispatch({ type: 'STATE_UPDATE', stepIndex: parsed.stepIndex, state: parsed.type.replace('STATE_', ''), payload: parsed.payload });
                        } else {
                            dispatch(parsed);
                        }
                    } catch (e) {
                        console.error("Failed to parse SSE", e);
                    }
                };

                es.onerror = () => {
                    es.close();
                    setStatus('RECONNECTING');
                    retryCount++;
                    const backoff = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    reconnectTimeoutRef.current = window.setTimeout(connect, backoff);
                };
            };

            connect();
        };

        initializeAndConnect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            setStatus('CLOSED');
        };
    }, [runId]);

    return { runState, events, status };
};
