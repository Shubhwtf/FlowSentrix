import React, { useEffect } from 'react';
import { Github, Menu, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

type TopNavProps = {
  onOpenSearch: () => void;
  onOpenSidebar: () => void;
  sidebarVisible: boolean;
  dashboardUrl: string;
  githubUrl: string;
};

export function TopNav({ onOpenSearch, onOpenSidebar, sidebarVisible, dashboardUrl, githubUrl }: TopNavProps) {
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const isTrigger = (isMac && event.metaKey && event.key.toLowerCase() === 'k') || (!isMac && event.ctrlKey && event.key.toLowerCase() === 'k');
      if (!isTrigger) return;
      event.preventDefault();
      onOpenSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenSearch]);

  return (
    <header className="sticky top-0 z-50 h-12 w-full bg-background border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-2 min-w-0">
        {!sidebarVisible && (
          <button
            onClick={onOpenSidebar}
            className="h-8 w-8 border border-border bg-transparent text-text-secondary hover:text-text-primary inline-flex items-center justify-center lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
        )}
        <span className="text-[15px] font-bold tracking-tight">FlowSentrix</span>
        <span className="text-text-muted">/</span>
        <span className="font-mono text-[12px] text-text-muted">Docs</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSearch}
          className="h-8 px-3 border border-border bg-transparent text-text-primary inline-flex items-center gap-2"
          aria-label="Search (Cmd+K)"
        >
          <Search size={16} className="text-text-secondary" />
          <span className="text-[12px]">Search</span>
          <span className="font-mono text-[11px] text-text-muted ml-2 hidden sm:inline">Ctrl K</span>
        </button>

        <button
          onClick={toggleTheme}
          className="h-8 w-8 border border-border bg-transparent text-text-secondary hover:text-text-primary inline-flex items-center justify-center"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <a
          href={dashboardUrl}
          target="_blank"
          rel="noreferrer"
          className="h-8 px-3 border border-border bg-transparent text-text-primary inline-flex items-center"
        >
          <span className="text-[12px]">Dashboard</span>
        </a>

        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          className="h-8 w-8 border border-border bg-transparent text-text-secondary hover:text-text-primary inline-flex items-center justify-center"
          aria-label="GitHub"
        >
          <Github size={18} />
        </a>
      </div>
    </header>
  );
}

