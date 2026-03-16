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

const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Workflows', path: '/workflows', icon: GitBranch },
    { name: 'Healing Events', path: '/healing', icon: HeartPulse },
    { name: 'Autopsy Reports', path: '/autopsy', icon: FileText },
    { name: 'HITL Queue', path: '/hitl', icon: UserCheck },
    { name: 'Compliance', path: '/compliance', icon: Shield },
    { name: 'Security', path: '/security', icon: Lock },
    { name: 'Risk Monitor', path: '/risk', icon: AlertTriangle },
    { name: 'Analytics', path: '/analytics', icon: BarChart },
    { name: 'Integrations', path: '/integrations', icon: Plug },
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
        <aside className="w-60 h-[calc(100vh-56px)] fixed left-0 top-14 bg-fs-surface-light dark:bg-fs-bg-dark border-r border-fs-border-light dark:border-fs-border-dark flex flex-col pt-4">
            <nav className="flex-1 px-3 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors ${isActive
                                ? 'bg-white dark:bg-fs-surface-dark text-fs-text-light dark:text-fs-text-dark border-l-2 border-fs-cyan'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-fs-surface-dark hover:text-fs-text-light dark:hover:text-fs-text-dark border-l-2 border-transparent'
                            }`
                        }
                    >
                        <div className="flex items-center space-x-3">
                            <item.icon size={18} />
                            <span>{item.name}</span>
                        </div>
                        {item.name === 'HITL Queue' && hitlCount > 0 && (
                            <span className="bg-red-500 text-white px-1.5 py-0.5 text-xs font-mono rounded-sm">
                                {hitlCount}
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-3 mb-4">
                <a href="/docs" target="_blank" rel="noreferrer" className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-500 hover:text-fs-text-light dark:hover:text-fs-text-dark border-l-2 border-transparent transition-colors">
                    <ExternalLink size={18} />
                    <span>API Docs</span>
                </a>
            </div>
        </aside>
    );
};
