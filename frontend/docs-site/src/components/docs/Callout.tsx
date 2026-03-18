import React from 'react';
import { AlertTriangle, CheckCircle, Info, Lightbulb, XCircle } from 'lucide-react';

type CalloutType = 'info' | 'warning' | 'danger' | 'success' | 'tip';

type CalloutProps = {
  type: CalloutType;
  title: string;
  children: React.ReactNode;
};

const styleForType = (type: CalloutType) => {
  switch (type) {
    case 'info':
      return { colorVar: '--info', icon: Info };
    case 'warning':
      return { colorVar: '--warning', icon: AlertTriangle };
    case 'danger':
      return { colorVar: '--destructive', icon: XCircle };
    case 'success':
      return { colorVar: '--success', icon: CheckCircle };
    case 'tip':
      return { colorVar: '--text-primary', icon: Lightbulb };
  }
};

export function Callout({ type, title, children }: CalloutProps) {
  const { colorVar, icon: Icon } = styleForType(type);
  const color = `rgb(var(${colorVar}))`;
  const background = `color-mix(in srgb, ${color} 6%, transparent)`;

  return (
    <div className="border border-border rounded-md p-4 border-l-[3px]" style={{ background, borderLeftColor: color }}>
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color }} />
        <div className="font-semibold text-[13px]" style={{ color }}>
          {title}
        </div>
      </div>
      <div className="mt-2 text-[13px] text-text-secondary leading-6">{children}</div>
    </div>
  );
}

