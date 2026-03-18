import React, { useEffect, useMemo, useState } from 'react';
import { DocLayout } from './components/layout/DocLayout';
import { SearchModal } from './components/search/SearchModal';
import { navigation, flattenPages } from './navigation';
import { contentBySlug } from './contentIndex';
import { buildSearchIndex } from './search';
import { Introduction } from './pages/Introduction';
import { Quickstart } from './pages/Quickstart';
import { Architecture } from './pages/Architecture';
import { Agents } from './pages/Agents';
import { Healing } from './pages/Healing';
import { Workflows } from './pages/Workflows';
import { Tools } from './pages/Tools';
import { Api } from './pages/Api';
import { Integrations } from './pages/Integrations';
import { Demo } from './pages/Demo';
import { Publishing } from './pages/Publishing';
import { Events } from './pages/Events';
import { StateMachine } from './pages/StateMachine';
import { Rollback } from './pages/Rollback';
import { Hitl } from './pages/Hitl';
import { Autopsy } from './pages/Autopsy';

const recentKey = 'flowsentrix-docs-recent';

const readRecent = () => {
  const raw = window.localStorage.getItem(recentKey);
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === 'string').slice(0, 8);
  } catch {
    return [];
  }
};

const readSlug = () => {
  const raw = window.location.hash.replace(/^#/, '').trim();
  return raw.length > 0 ? raw : 'introduction';
};

const setSlug = (slug: string) => {
  window.location.hash = `#${slug}`;
};

const titleBySlug = () => {
  const map: Record<string, { title: string; section: string }> = {};
  flattenPages(navigation).forEach((page) => {
    map[page.slug] = { title: page.title, section: page.section };
  });
  return map;
};

const pageForSlug = (slug: string) => {
  switch (slug) {
    case 'events':
      return <Events />;
    case 'state-machine':
      return <StateMachine />;
    case 'rollback':
      return <Rollback />;
    case 'hitl':
      return <Hitl />;
    case 'autopsy':
      return <Autopsy />;
    case 'quickstart':
      return <Quickstart />;
    case 'architecture':
      return <Architecture />;
    case 'agents':
      return <Agents />;
    case 'healing':
      return <Healing />;
    case 'workflows':
      return <Workflows />;
    case 'tools':
      return <Tools />;
    case 'api':
      return <Api />;
    case 'integrations':
      return <Integrations />;
    case 'demo':
      return <Demo />;
    case 'publishing':
      return <Publishing />;
    case 'introduction':
    default:
      return <Introduction />;
  }
};

export function App() {
  const [slug, setSlugState] = useState(() => readSlug());
  const [searchOpen, setSearchOpen] = useState(false);
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() => readRecent());

  const titles = useMemo(() => titleBySlug(), []);
  const searchIndex = useMemo(() => buildSearchIndex(navigation, contentBySlug), []);

  useEffect(() => {
    const onHashChange = () => setSlugState(readSlug());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const known = titles[slug] ? slug : 'introduction';
    if (known !== slug) setSlug(known);
    const next = [known, ...recentSlugs.filter((s) => s !== known)].slice(0, 8);
    window.localStorage.setItem(recentKey, JSON.stringify(next));
    setRecentSlugs(next);
  }, [slug, titles, recentSlugs]);

  return (
    <>
      <DocLayout
        sections={navigation}
        activeSlug={slug}
        onNavigate={(s) => setSlug(s)}
        onOpenSearch={() => setSearchOpen(true)}
        dashboardUrl="/"
        githubUrl="https://github.com/"
      >
        {pageForSlug(slug)}
      </DocLayout>

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        index={searchIndex}
        onNavigate={(s) => setSlug(s)}
        recentSlugs={recentSlugs}
        titleBySlug={titles}
      />
    </>
  );
}

