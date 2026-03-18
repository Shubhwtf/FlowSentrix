import React, { useEffect, useId, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '../../contexts/ThemeContext';
import { CodeBlock } from './CodeBlock';

type MermaidDiagramProps = {
  chart: string;
  caption?: string;
};

type RenderState =
  | { type: 'loading' }
  | { type: 'ready'; svg: string }
  | { type: 'error'; message: string };

type MermaidRenderResult = {
  svg: string;
  bindFunctions?: (element: Element) => void;
};

const clampRgb = (value: number) => Math.max(0, Math.min(255, value));

const rgbTripletFromCssVar = (cssVarValue: string) => {
  const parts = cssVarValue
    .trim()
    .split(/\s+/)
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n));
  if (parts.length < 3) return null;
  return { r: clampRgb(parts[0]), g: clampRgb(parts[1]), b: clampRgb(parts[2]) };
};

const hexFromRgb = (rgb: { r: number; g: number; b: number }) => {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};

const readCssColor = (name: string, fallback: string) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const rgb = rgbTripletFromCssVar(raw);
  return rgb ? hexFromRgb(rgb) : fallback;
};

const configForTheme = (theme: 'dark' | 'light') => {
  const surface = readCssColor('--surface', theme === 'dark' ? '#0a0a0a' : '#fafafa');
  const surfaceElevated = readCssColor('--surface-elevated', theme === 'dark' ? '#111111' : '#f4f4f5');
  const border = readCssColor('--border', theme === 'dark' ? '#1f1f1f' : '#e4e4e7');
  const textPrimary = readCssColor('--text-primary', theme === 'dark' ? '#ffffff' : '#000000');
  const textMuted = readCssColor('--text-muted', theme === 'dark' ? '#52525b' : '#a1a1aa');

  return {
    theme: theme === 'dark' ? ('dark' as const) : ('neutral' as const),
    themeVariables: {
      background: 'transparent',
      primaryColor: surfaceElevated,
      secondaryColor: surface,
      tertiaryColor: surface,
      primaryBorderColor: border,
      lineColor: textMuted,
      textColor: textPrimary,
      fontFamily: 'var(--font-geist), system-ui, sans-serif'
    }
  };
};

export function MermaidDiagram({ chart, caption }: MermaidDiagramProps) {
  const id = useId();
  const { theme } = useTheme();
  const [state, setState] = useState<RenderState>({ type: 'loading' });

  const stableChart = useMemo(() => chart.trim(), [chart]);

  useEffect(() => {
    let cancelled = false;
    setState({ type: 'loading' });

    const run = async () => {
      try {
        mermaid.initialize({ startOnLoad: false, ...configForTheme(theme), securityLevel: 'loose' });
        const result = (await mermaid.render(`mermaid-${id.replace(/:/g, '-')}`, stableChart)) as unknown;
        const parsed = result as MermaidRenderResult;
        if (!parsed.svg) throw new Error('Mermaid render returned empty SVG');
        if (!cancelled) setState({ type: 'ready', svg: parsed.svg });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Mermaid render failed';
        if (!cancelled) setState({ type: 'error', message });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [stableChart, theme, id]);

  return (
    <div className="border border-border rounded-md bg-surface p-6 overflow-x-auto min-h-[200px]">
      {state.type === 'loading' && <div className="h-48 w-full bg-surface-elevated animate-pulse" />}
      {state.type === 'ready' && <div dangerouslySetInnerHTML={{ __html: state.svg }} />}
      {state.type === 'error' && <CodeBlock code={stableChart} language="text" filename={`Mermaid error: ${state.message}`} />}
      {caption && <div className="mt-4 text-[13px] text-text-muted italic text-center">{caption}</div>}
    </div>
  );
}

