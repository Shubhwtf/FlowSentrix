import React, { useState } from 'react';
import {
    Mail,
    Github,
    MessageSquare,
    Database,
    ShieldCheck,
    Cloud,
    CreditCard
} from 'lucide-react';

const mockIntegrations = [
    { id: 'ms-graph', name: 'Microsoft Graph API', icon: Mail, status: 'mock', lastTst: '2m ago' },
    { id: 'github', name: 'GitHub Enteprise', icon: Github, status: 'connected', lastTst: '1h ago' },
    { id: 'slack', name: 'Slack Workspace', icon: MessageSquare, status: 'mock', lastTst: 'Never' },
    { id: 'postgres', name: 'PostgreSQL Core', icon: Database, status: 'connected', lastTst: '10s ago' },
    { id: 'snyk', name: 'Snyk Security', icon: ShieldCheck, status: 'disconnected', lastTst: '3d ago' },
    { id: 'aws', name: 'AWS CloudTrail', icon: Cloud, status: 'mock', lastTst: '12h ago' },
    { id: 'stripe', name: 'Stripe Billing', icon: CreditCard, status: 'disconnected', lastTst: 'Never' },
];

export const IntegrationsGrid: React.FC = () => {
    const [testing, setTesting] = useState<string | null>(null);

    const getStatusDisplay = (status: string) => {
        switch (status) {
            case 'connected': return <div className="flex items-center space-x-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-green-500">Connected</span></div>;
            case 'mock': return <div className="flex items-center space-x-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div><span className="text-amber-500">Mock Mode</span></div>;
            case 'disconnected': return <div className="flex items-center space-x-1"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-red-500">Disconnected</span></div>;
            default: return null;
        }
    };

    const handleTest = (id: string) => {
        setTesting(id);
        setTimeout(() => setTesting(null), 1500);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-2xl font-bold tracking-tight">System Integrations</h1>
                <button className="text-xs font-mono uppercase bg-fs-cyan text-black px-4 py-1.5 font-bold hover:bg-opacity-90 transition-opacity">Add Integration</button>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {mockIntegrations.map(int => (
                    <div key={int.id} className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-6 flex flex-col hover:border-fs-cyan transition-colors">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 bg-fs-surface-light dark:bg-fs-bg-dark border border-fs-border-light dark:border-fs-border-dark flex items-center justify-center">
                                <int.icon size={24} className="opacity-80" />
                            </div>
                            {int.status === 'mock' && (
                                <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/30">MOCK</span>
                            )}
                        </div>

                        <h3 className="font-bold tracking-tight text-lg mb-4">{int.name}</h3>

                        <div className="flex-1 flex flex-col justify-end space-y-4">
                            <div className="flex justify-between items-end font-mono text-xs uppercase">
                                {getStatusDisplay(int.status)}
                                <span className="text-gray-500">Last: {int.lastTst}</span>
                            </div>

                            <button
                                onClick={() => handleTest(int.id)}
                                disabled={testing === int.id}
                                className="w-full border border-fs-border-light dark:border-fs-border-dark py-2 font-mono text-xs font-bold uppercase hover:bg-fs-surface-light dark:hover:bg-fs-bg-dark transition-colors disabled:opacity-50"
                            >
                                {testing === int.id ? 'TESTING...' : 'TEST CONNECTION'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
