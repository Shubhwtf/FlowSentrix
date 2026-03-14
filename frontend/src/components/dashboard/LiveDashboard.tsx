import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StatCards } from '../dashboard/StatCards';
import { WorkflowSelector } from '../dashboard/WorkflowSelector';
import { RunTimeline } from '../dashboard/RunTimeline';
import { EventLog } from '../dashboard/EventLog';
import { useSSEStream } from '../../hooks/useSSEStream';
import { useRightDrawer } from '../../hooks/useRightDrawer';
import { RightDrawer } from '../layout/RightDrawer';
import { API } from '../../api/client';

const AutopsyActionPanel: React.FC<{ runId: string, reportText: string, onClose: () => void }> = ({ runId, reportText, onClose }) => {
    const [snapshots, setSnapshots] = React.useState<any[]>([]);
    const [isRollingBack, setIsRollingBack] = React.useState(false);

    React.useEffect(() => {
        API.runs.getSnapshots(runId).then(data => setSnapshots(data)).catch(console.error);
    }, [runId]);

    const handleRollback = async (snapId: string) => {
        if (!confirm('Are you sure you want to rollback to this state?')) return;
        setIsRollingBack(true);
        try {
            await API.runs.rollback(runId, snapId);
            onClose();
        } catch (e) {
            console.error(e);
            alert('Rollback failed');
        }
        setIsRollingBack(false);
    };

    const handleRetry = async () => {
        try {
            await API.runs.retry(runId);
            onClose();
        } catch (e) {
            console.error(e);
            alert('Retry failed');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="uppercase font-mono text-xs text-purple-500 mb-1">Live Autopsy</h3>
                <p className="text-lg font-bold">Action Analysis</p>
            </div>
            <div className="bg-fs-surface-light dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-4 font-mono text-sm leading-relaxed prose dark:prose-invert">
                {reportText}
            </div>

            <div className="pt-4 border-t border-fs-border-light dark:border-fs-border-dark space-y-4">
                <h4 className="font-mono text-xs text-gray-500 uppercase">Available Time-Travel Snapshots</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {snapshots.map(snap => (
                        <div key={snap.id} className="flex items-center justify-between p-3 border border-fs-border-light dark:border-fs-border-dark bg-white dark:bg-fs-surface-dark">
                            <span className="font-mono text-sm text-fs-cyan">Step {snap.step_index}</span>
                            <button
                                onClick={() => handleRollback(snap.id)}
                                disabled={isRollingBack}
                                className="px-3 py-1 bg-fs-cyan text-black font-mono text-xs hover:bg-opacity-90 disabled:opacity-50"
                            >
                                ROLLBACK
                            </button>
                        </div>
                    ))}
                    {snapshots.length === 0 && <p className="text-xs text-gray-500 italic">No snapshots available.</p>}
                </div>
            </div>

            <div className="flex space-x-4 pt-4">
                <button onClick={handleRetry} className="flex-1 bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark text-fs-text-light dark:text-fs-text-dark py-2 font-medium hover:bg-gray-50 dark:hover:bg-fs-bg-dark transition-colors">
                    RETRY FROM FAILURE
                </button>
            </div>
        </div>
    );
};

export const LiveDashboard: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const runId = searchParams.get('run');
    const { runState, events } = useSSEStream(runId);
    const { isOpen, content, openDrawer, closeDrawer } = useRightDrawer();

    useEffect(() => {
        // Automatically open autopsy Drawer when an autopsy event is generated
        const autopsyEvent = events.find(e => e.type === 'AUTOPSY_GENERATED');
        if (autopsyEvent && !isOpen && runId) {
            openDrawer(
                <AutopsyActionPanel
                    runId={runId}
                    reportText={autopsyEvent.payload.reportText}
                    onClose={closeDrawer}
                />
            );
        }
    }, [events, isOpen, runId, openDrawer, closeDrawer]);

    return (
        <div className="flex flex-col h-full max-h-full">
            <StatCards />
            <WorkflowSelector
                selectedId={runState?.workflowId || null}
                onSelect={(id) => id ? setSearchParams({ run: id }) : setSearchParams({})}
            />

            <div className="flex-1 flex flex-col min-h-0">
                <RunTimeline runState={runState} />
                <EventLog events={events} />
            </div>

            <RightDrawer isOpen={isOpen} onClose={closeDrawer}>
                {content}
            </RightDrawer>
        </div>
    );
};
