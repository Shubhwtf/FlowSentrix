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
        if (type.includes('HEAL_REQUIRED')) return 'text-amber-500';
        if (type.includes('HEAL_SUCCEEDED') || type.includes('STEP_OUTPUT')) return 'text-cyan-500';
        if (type.includes('AUTOPSY')) return 'text-purple-500';
        if (type.includes('FAIL')) return 'text-red-500';
        if (type.includes('ROLLBACK')) return 'text-orange-500';
        return 'text-gray-400 dark:text-gray-500';
    };

    return (
        <div className="h-48 border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-black mt-4 flex flex-col relative font-mono text-xs shadow-inner">
            <div className="flex justify-between items-center px-4 py-2 border-b border-fs-border-light dark:border-fs-border-dark bg-fs-surface-light dark:bg-fs-surface-dark sticky top-0 uppercase tracking-widest text-[10px] z-10">
                <span>System Event Log</span>
                {!autoScroll && (
                    <button
                        onClick={() => { setAutoScroll(true); if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }}
                        className="text-fs-cyan hover:underline"
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
                    <div className="text-gray-500 italic">No events recorded. Waiting for payload...</div>
                ) : (
                    events.slice().reverse().map((ev, i) => (
                        <div key={i} className="flex space-x-4 hover:bg-white/5 px-2 py-1 -mx-2 transition-colors">
                            <span className="text-gray-500 w-20 shrink-0">
                                {new Date(ev.timestamp || Date.now()).toLocaleTimeString('en-US', { hour12: false })}
                            </span>
                            <span className={`w-36 shrink-0 font-bold ${getTypeColor(ev.type)}`}>[{ev.type}]</span>
                            <span className="text-fs-text-light dark:text-gray-300 truncate">
                                {ev.payload ? typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload).substring(0, 100) : ''}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
