import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Home,
    GitBranch,
    HeartPulse,
    FileText,
    UserCheck,
    Shield,
    Lock,
    AlertTriangle,
    BarChart,
    Plug,
    ExternalLink
} from 'lucide-react';
import { API } from '../../api/client';

const navGroups = [
    {
        label: 'Operations',
        items: [
            { name: 'Dashboard', path: '/', icon: Home },
            { name: 'Workflows', path: '/workflows', icon: GitBranch },
            { name: 'Runs', path: '/runs', icon: GitBranch },
            { name: 'Healing Events', path: '/healing', icon: HeartPulse },
            { name: 'HITL Queue', path: '/hitl', icon: UserCheck },
            { name: 'Autopsy Reports', path: '/autopsy', icon: FileText },
        ],
    },
    {
        label: 'Governance',
        items: [
            { name: 'Compliance', path: '/compliance', icon: Shield },
            { name: 'Security', path: '/security', icon: Lock },
            { name: 'Risk Monitor', path: '/risk', icon: AlertTriangle },
            { name: 'Analytics', path: '/analytics', icon: BarChart },
            { name: 'Integrations', path: '/integrations', icon: Plug },
        ],
    },
];

export const Sidebar: React.FC = () => {
    const [hitlCount, setHitlCount] = useState(0);

    useEffect(() => {
        const fetchCount = () => {
            API.hitl.list()
                .then(data => setHitlCount(data.filter((e: any) => e.status === 'PENDING').length))
                .catch(() => { });
        };
        fetchCount();
        const interval = setInterval(fetchCount, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <aside className="w-[220px] h-[calc(100vh-48px)] fixed left-0 top-12 bg-surface border-r border-border flex flex-col">
            <nav className="flex-1 px-3 py-3 space-y-3">
                {navGroups.map((group, groupIndex) => (
                    <div key={group.label} className="space-y-1">
                        {groupIndex > 0 && <div className="h-px bg-border-subtle my-2" />}
                        <p className="px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-text-muted">{group.label}</p>
                        {group.items.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                className={({ isActive }) =>
                                    `h-10 px-3 text-[13px] font-medium flex items-center justify-between border-l-2 ${isActive
                                        ? 'bg-surface-elevated text-text-primary border-l-text-primary'
                                        : 'text-text-secondary border-l-transparent hover:bg-surface-elevated hover:text-text-primary'
                                    }`
                                }
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon size={15} strokeWidth={1.5} />
                                    <span>{item.name}</span>
                                </div>
                                {item.name === 'HITL Queue' && hitlCount > 0 && (
                                    <span data-badge className="bg-destructive/10 text-destructive border border-destructive/20">
                                        {hitlCount}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="p-3 mb-4">
                <a href="/docs" target="_blank" rel="noreferrer" className="h-10 px-3 text-[13px] font-medium flex items-center gap-3 text-text-secondary hover:bg-surface-elevated hover:text-text-primary border-l-2 border-l-transparent">
                    <ExternalLink size={15} strokeWidth={1.5} />
                    <span>API Docs</span>
                </a>
            </div>
        </aside>
    );
};
