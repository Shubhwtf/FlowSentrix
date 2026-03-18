import React, { useEffect, useMemo, useRef, useState } from 'react';
import type Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import type { SearchDocument, SearchResult } from '../../search';
import { excerptFromMatches } from '../../search';

type SearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  index: Fuse<SearchDocument>;
  onNavigate: (slug: string) => void;
  recentSlugs: string[];
  titleBySlug: Record<string, { title: string; section: string }>;
};

const recentKey = 'flowsentrix-docs-recent';

const writeRecent = (slugs: string[]) => {
  window.localStorage.setItem(recentKey, JSON.stringify(slugs));
};

const buildMarkedExcerpt = (content: string, indices: ReadonlyArray<readonly [number, number]>) => {
  const excerpt = excerptFromMatches(content, indices);
  if (!indices[0]) return { excerpt, parts: [excerpt] as Array<string | { mark: string }> };
  const first = indices[0];
  const center = Math.floor((first[0] + first[1]) / 2);
  const start = Math.max(0, center - 90);
  const end = Math.min(content.length, center + 90);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  const slice = content.slice(start, end);

  const sliceMatches = indices
    .map(([a, b]) => [Math.max(a - start, 0), Math.min(b - start, slice.length - 1)] as const)
    .filter(([a, b]) => a < slice.length && b >= 0 && a <= b)
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  sliceMatches.forEach(([a, b]) => {
    const last = merged[merged.length - 1];
    if (!last) merged.push([a, b]);
    else if (a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  });

  const parts: Array<string | { mark: string }> = [];
  let cursor = 0;
  merged.forEach(([a, b]) => {
    const before = slice.slice(cursor, a);
    if (before) parts.push(before);
    const marked = slice.slice(a, b + 1);
    if (marked) parts.push({ mark: marked });
    cursor = b + 1;
  });
  const after = slice.slice(cursor);
  if (after) parts.push(after);

  return { excerpt: `${prefix}${slice}${suffix}`, parts: [prefix, ...parts, suffix].filter((p) => p !== '') as Array<string | { mark: string }> };
};

export function SearchModal({ isOpen, onClose, index, onNavigate, recentSlugs, titleBySlug }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return index.search(trimmed, { limit: 20 }).map((r) => {
      const match = r.matches?.find((m) => m.key === 'content' && Array.isArray(m.indices));
      const indices = match?.indices ?? [];
      const marked = buildMarkedExcerpt(r.item.content, indices);
      const out: SearchResult = {
        slug: r.item.slug,
        title: r.item.title,
        section: r.item.section,
        excerpt: marked.excerpt
      };
      return { result: out, parts: marked.parts };
    });
  }, [query, index]);

  const recent = useMemo(() => {
    return recentSlugs
      .map((slug) => {
        const meta = titleBySlug[slug];
        if (!meta) return null;
        return { slug, title: meta.title, section: meta.section };
      })
      .filter((v): v is { slug: string; title: string; section: string } => Boolean(v));
  }, [recentSlugs, titleBySlug]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!query.trim()) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const selected = results[selectedIndex];
        if (!selected) return;
        onNavigate(selected.result.slug);
        onClose();
        const nextRecent = [selected.result.slug, ...recentSlugs.filter((s) => s !== selected.result.slug)].slice(0, 8);
        writeRecent(nextRecent);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, query, results, selectedIndex, onNavigate, onClose, recentSlugs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-1/2 top-24 -translate-x-1/2 w-[600px] max-w-[calc(100vw-32px)] bg-surface border border-border rounded-md overflow-hidden">
        <div className="h-12 px-4 flex items-center gap-3 border-b border-border bg-surface-elevated">
          <Search size={18} className="text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 h-9 bg-background border border-border rounded-md px-3 outline-none focus:border-text-primary"
            placeholder="Search docs…"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {!query.trim() && (
            <div className="p-4">
              <div className="font-mono text-[10px] uppercase tracking-wide text-text-muted mb-3">RECENT</div>
              {recent.length === 0 ? (
                <div className="text-[13px] text-text-secondary">No recent pages yet. Start typing to search.</div>
              ) : (
                <div className="space-y-1">
                  {recent.map((r) => (
                    <button
                      key={r.slug}
                      onClick={() => {
                        onNavigate(r.slug);
                        onClose();
                      }}
                      className="w-full text-left px-3 py-3 border border-border rounded-md bg-surface hover:bg-surface-elevated"
                    >
                      <div className="text-[13px] font-semibold">{r.title}</div>
                      <div className="font-mono text-[11px] text-text-muted mt-1">{r.section}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {query.trim() && (
            <div className="p-2">
              {results.length === 0 ? (
                <div className="p-4 text-[13px] text-text-secondary">No results.</div>
              ) : (
                <div className="space-y-1">
                  {results.map((r, idx) => (
                    <button
                      key={r.result.slug}
                      onClick={() => {
                        onNavigate(r.result.slug);
                        onClose();
                        const nextRecent = [r.result.slug, ...recentSlugs.filter((s) => s !== r.result.slug)].slice(0, 8);
                        writeRecent(nextRecent);
                      }}
                      className={`w-full text-left px-3 py-3 border border-border rounded-md ${
                        idx === selectedIndex ? 'bg-surface-elevated' : 'bg-surface'
                      } hover:bg-surface-elevated`}
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="text-[13px] font-semibold">{r.result.title}</div>
                        <div className="font-mono text-[11px] text-text-muted">{r.result.section}</div>
                      </div>
                      <div className="mt-2 text-[12px] text-text-secondary leading-5">
                        {r.parts.map((p, i) => {
                          if (typeof p === 'string') return <React.Fragment key={i}>{p}</React.Fragment>;
                          return <mark key={i}>{p.mark}</mark>;
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

