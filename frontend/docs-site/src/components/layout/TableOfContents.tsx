import React, { useEffect, useMemo, useRef, useState } from 'react';

type TocHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

type TableOfContentsProps = {
  contentRoot: React.RefObject<HTMLElement | null>;
  activeSlug: string;
};

const readHeadings = (root: HTMLElement) => {
  const nodes = Array.from(root.querySelectorAll('h2[id], h3[id]'));
  const headings: TocHeading[] = [];
  nodes.forEach((node) => {
    const tag = node.tagName.toLowerCase();
    const id = node.getAttribute('id');
    if (!id) return;
    const level: 2 | 3 = tag === 'h3' ? 3 : 2;
    const text = node.textContent?.trim() ?? '';
    if (!text) return;
    headings.push({ id, text, level });
  });
  return headings;
};

export function TableOfContents({ contentRoot, activeSlug }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const root = contentRoot.current;
    if (!root) return;
    const raf = requestAnimationFrame(() => {
      setHeadings(readHeadings(root));
      setActiveId('');
    });
    return () => cancelAnimationFrame(raf);
  }, [contentRoot, activeSlug]);

  useEffect(() => {
    const root = contentRoot.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll('h2[id], h3[id]'));
    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0));
        const top = visible[0];
        const id = top?.target instanceof HTMLElement ? top.target.id : '';
        if (id) setActiveId(id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 1] }
    );
    nodes.forEach((node) => observer.observe(node));
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [contentRoot, headings.length]);

  const items = useMemo(() => headings, [headings]);

  return (
    <aside className="hidden xl:block w-[200px] sticky top-16 h-[calc(100vh-64px)] overflow-y-auto mr-12">
      <div className="pt-6">
        <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted mb-3">ON THIS PAGE</div>
        <div className="space-y-1">
          {items.map((heading) => {
            const isActive = heading.id === activeId;
            const indent = heading.level === 3 ? 'pl-4' : 'pl-0';
            return (
              <button
                key={heading.id}
                onClick={() => document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`w-full text-left text-[12px] py-1 ${indent} border-l-2 ${
                  isActive ? 'text-text-primary border-l-text-primary' : 'text-text-secondary border-l-transparent hover:text-text-primary'
                }`}
              >
                {heading.text}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

