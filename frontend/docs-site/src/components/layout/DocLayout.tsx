import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { NavigationSection } from '../../navigation';
import { Sidebar } from './Sidebar';
import { TableOfContents } from './TableOfContents';
import { TopNav } from './TopNav';
import { PageNavigation } from './PageNavigation';

type DocLayoutProps = {
  sections: NavigationSection[];
  activeSlug: string;
  onNavigate: (slug: string) => void;
  onOpenSearch: () => void;
  dashboardUrl: string;
  githubUrl: string;
  children: React.ReactNode;
};

export function DocLayout({ sections, activeSlug, onNavigate, onOpenSearch, dashboardUrl, githubUrl, children }: DocLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const contentRef = useRef<HTMLElement | null>(null);

  const desktopSidebar = useMemo(() => {
    return (
      <div className="hidden lg:block">
        <Sidebar sections={sections} activeSlug={activeSlug} onNavigate={onNavigate} variant="desktop" />
      </div>
    );
  }, [sections, activeSlug, onNavigate]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        onOpenSearch={onOpenSearch}
        onOpenSidebar={() => setDrawerOpen(true)}
        sidebarVisible={false}
        dashboardUrl={dashboardUrl}
        githubUrl={githubUrl}
      />

      {desktopSidebar}

      <AnimatePresence>
        {drawerOpen && (
          <motion.div className="fixed inset-0 z-[90] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <motion.div
              className="absolute left-0 top-12 bottom-0"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <Sidebar
                sections={sections}
                activeSlug={activeSlug}
                onNavigate={onNavigate}
                variant="drawer"
                onCloseDrawer={() => setDrawerOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-6">
        <div className="max-w-none px-6">
          <div className="flex gap-8">
            <main className="flex-1 min-w-0">
              <div className="max-w-[900px] mx-auto px-0 py-10">
                <header className="mb-8 border-b border-border pb-4">
                  <h1 className="text-2xl font-semibold tracking-tight text-text-primary">FlowSentrix Documentation</h1>
                </header>
                <article ref={contentRef} className="prose prose-invert max-w-none">
                  {children}
                  <PageNavigation sections={sections} activeSlug={activeSlug} onNavigate={onNavigate} />
                </article>
              </div>
            </main>
            <TableOfContents contentRoot={contentRef} activeSlug={activeSlug} />
          </div>
        </div>
      </div>
    </div>
  );
}

