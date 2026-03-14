import { useState, useEffect, useReducer, useRef } from 'react';
import { runReducer } from '../store/runReducer';
import type { RunState } from '../store/types';

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

        let retryCount = 0;

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
                    const parsed = JSON.parse(event.data);
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
