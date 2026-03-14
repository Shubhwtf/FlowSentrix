import React, { useEffect, useState } from 'react';
import { API } from '../../api/client';

export const StatCards: React.FC = () => {
    const [stats, setStats] = useState({ runs: 0, success: 0, heal: '0s', hitl: 0 });

    useEffect(() => {
        API.runs.list().then(runs => {
            const completed = runs.filter(r => r.status === 'COMPLETED');
            const rate = runs.length ? Math.round((completed.length / runs.length) * 100) : 0;

            setStats({
                runs: runs.length,
                success: rate,
                heal: '2.4s', // Mocked aggregate for display
                hitl: 0       // Mocked aggregate
            });
        }).catch(console.error);
    }, []);

    const cards = [
        { label: 'TOTAL RUNS', value: stats.runs, delta: '+12%' },
        { label: 'SUCCESS RATE', value: `${stats.success}%`, delta: '+1%' },
        { label: 'AVG HEAL TIME', value: stats.heal, delta: '-0.3s' },
        { label: 'HITL RATE', value: `${stats.hitl}%`, delta: '0%' },
    ];

    return (
        <div className="grid grid-cols-4 gap-4 mb-6">
            {cards.map((card, i) => (
                <div key={i} className="bg-white dark:bg-fs-surface-dark border border-fs-border-light dark:border-fs-border-dark p-5 flex flex-col justify-between">
                    <span className="font-mono text-[10px] text-gray-500 tracking-wider font-semibold">{card.label}</span>
                    <div className="flex items-baseline space-x-2 mt-2">
                        <span className="font-mono font-bold text-4xl">{card.value}</span>
                        <span className={`text-xs font-mono ${card.delta.startsWith('+') && parseInt(card.delta) > 0 ? 'text-green-500' : card.delta.startsWith('-') ? 'text-fs-cyan' : 'text-gray-500'}`}>
                            {card.delta.startsWith('+') ? '↑' : card.delta.startsWith('-') ? '↓' : ''} {card.delta.replace(/[+-]/, '')}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};
