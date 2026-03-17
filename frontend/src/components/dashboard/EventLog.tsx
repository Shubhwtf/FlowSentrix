import React, { useRef, useEffect, useState } from 'react';

export const EventLog: React.FC<{ events: any[] }> = ({ events }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [events, autoScroll]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        if (scrollHeight - scrollTop - clientHeight > 50) {
            setAutoScroll(false);
        } else {
            setAutoScroll(true);
        }
    };

    const getTypeColor = (type: string) => {
        if (type.includes('HEAL_REQUIRED')) return 'text-warning';
        if (type.includes('HEAL_SUCCEEDED') || type.includes('STEP_OUTPUT')) return 'text-text-primary';
        if (type.includes('AUTOPSY')) return 'text-purple-500';
        if (type.includes('FAIL')) return 'text-destructive';
        if (type.includes('ROLLBACK')) return 'text-orange-500';
        return 'text-text-secondary';
    };

    return (
        <div className="h-48 border border-border bg-background rounded-md mt-4 flex flex-col relative font-mono text-[11px]">
            <div className="flex justify-between items-center px-4 py-2 border-b border-border bg-surface sticky top-0 uppercase tracking-widest text-[10px] z-10">
                <span>System Event Log</span>
                {!autoScroll && (
                    <button
                        onClick={() => { setAutoScroll(true); if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }}
                        className="text-text-primary hover:underline"
                    >
                        Resume Auto-scroll ↓
                    </button>
                )}
            </div>
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-2 opacity-90"
            >
                {events.length === 0 ? (
                    <div className="text-text-secondary italic">No events recorded. Waiting for payload...</div>
                ) : (
                    events.slice().reverse().map((ev, i) => (
                        <div key={i} className={`flex space-x-4 px-2 py-1 -mx-2 ${i % 2 === 0 ? 'bg-surface-elevated/20' : ''}`}>
                            <span className="text-text-muted w-20 shrink-0">
                                {new Date(ev.timestamp || Date.now()).toLocaleTimeString('en-US', { hour12: false })}
                            </span>
                            <span className={`w-36 shrink-0 font-bold ${getTypeColor(ev.type)}`}>[{ev.type}]</span>
                            <span className="text-text-secondary truncate">
                                {ev.payload ? typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload).substring(0, 100) : ''}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
