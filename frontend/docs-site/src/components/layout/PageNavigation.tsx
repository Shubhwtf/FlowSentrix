import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { NavigationSection } from '../../navigation';
import { flattenPages } from '../../navigation';

type PageNavigationProps = {
  sections: NavigationSection[];
  activeSlug: string;
  onNavigate: (slug: string) => void;
};

export function PageNavigation({ sections, activeSlug, onNavigate }: PageNavigationProps) {
  const pages = useMemo(() => flattenPages(sections), [sections]);
  const index = pages.findIndex((page) => page.slug === activeSlug);
  const prev = index > 0 ? pages[index - 1] : null;
  const next = index >= 0 && index < pages.length - 1 ? pages[index + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
      {prev ? (
        <button
          onClick={() => onNavigate(prev.slug)}
          className="bg-surface border border-border rounded-md p-4 text-left hover:bg-surface-elevated transition-colors"
        >
          <div className="flex items-center gap-2 text-text-secondary text-[12px]">
            <ArrowLeft size={14} />
            <span className="font-mono uppercase tracking-wide">Previous</span>
          </div>
          <div className="mt-2 font-semibold">{prev.title}</div>
        </button>
      ) : (
        <div />
      )}

      {next ? (
        <button
          onClick={() => onNavigate(next.slug)}
          className="bg-surface border border-border rounded-md p-4 text-left hover:bg-surface-elevated transition-colors"
        >
          <div className="flex items-center gap-2 justify-end text-text-secondary text-[12px]">
            <span className="font-mono uppercase tracking-wide">Next</span>
            <ArrowRight size={14} />
          </div>
          <div className="mt-2 font-semibold text-right">{next.title}</div>
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}

