import Fuse from 'fuse.js';
import type { NavigationSection } from './navigation';
import { flattenPages } from './navigation';

export type SearchDocument = {
  slug: string;
  title: string;
  section: string;
  content: string;
};

export type SearchResult = {
  slug: string;
  title: string;
  section: string;
  excerpt: string;
};

export const buildSearchIndex = (sections: NavigationSection[], contentBySlug: Record<string, string>) => {
  const docs: SearchDocument[] = flattenPages(sections).map((page) => ({
    slug: page.slug,
    title: page.title,
    section: page.section,
    content: contentBySlug[page.slug] ?? ''
  }));

  return new Fuse<SearchDocument>(docs, {
    keys: ['title', 'section', 'content'],
    threshold: 0.3,
    includeMatches: true
  });
};

export const excerptFromMatches = (content: string, matchIndices: ReadonlyArray<readonly [number, number]>) => {
  const first = matchIndices[0];
  if (!first) return content.slice(0, 180);
  const center = Math.floor((first[0] + first[1]) / 2);
  const start = Math.max(0, center - 90);
  const end = Math.min(content.length, center + 90);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return `${prefix}${content.slice(start, end)}${suffix}`;
};

