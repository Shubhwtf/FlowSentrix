import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { NavigationSection } from '../../navigation';

type SidebarProps = {
  sections: NavigationSection[];
  activeSlug: string;
  onNavigate: (slug: string) => void;
  variant: 'desktop' | 'drawer';
  onCloseDrawer?: () => void;
};

type SectionState = Record<string, boolean>;

const defaultExpanded = (sections: NavigationSection[]) => {
  const state: SectionState = {};
  sections.forEach((section) => {
    state[section.title] = true;
  });
  return state;
};

export function Sidebar({ sections, activeSlug, onNavigate, variant, onCloseDrawer }: SidebarProps) {
  const [expanded, setExpanded] = useState<SectionState>(() => defaultExpanded(sections));

  const wrapperClassName = useMemo(() => {
    const base = 'w-[260px] h-[calc(100vh-48px)] bg-surface border-r border-border overflow-y-auto';
    if (variant === 'desktop') return `${base} fixed left-0 top-12`;
    return `${base}`;
  }, [variant]);

  return (
    <aside className={wrapperClassName}>
      <nav className="px-3 py-3 space-y-3">
        {sections.map((section) => {
          const isExpanded = expanded[section.title] ?? true;
          return (
            <div key={section.title}>
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [section.title]: !(prev[section.title] ?? true) }))}
                className="w-full flex items-center justify-between px-3 pt-4 pb-2"
                aria-expanded={isExpanded}
              >
                <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">{section.title}</span>
                <motion.span
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="text-text-muted"
                >
                  <ChevronRight size={14} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1">
                      {section.pages.map((page) => {
                        const isActive = page.slug === activeSlug;
                        const className = `h-10 px-3 text-[13px] font-medium flex items-center justify-between border-l-2 ${
                          isActive
                            ? 'bg-surface-elevated text-text-primary border-l-text-primary'
                            : 'text-text-secondary border-l-transparent hover:bg-surface-elevated hover:text-text-primary'
                        }`;

                        return (
                          <button
                            key={page.slug}
                            onClick={() => {
                              onNavigate(page.slug);
                              onCloseDrawer?.();
                            }}
                            className={className}
                          >
                            <span className="truncate">{page.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

