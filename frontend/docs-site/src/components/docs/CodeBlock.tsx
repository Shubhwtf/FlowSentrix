import React, { useCallback, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../contexts/ThemeContext';

type CodeBlockProps = {
  code: string;
  language: string;
  filename?: string;
  highlight?: number[];
};

const toHighlightSet = (lines?: number[]) => new Set(lines ?? []);

export function CodeBlock({ code, language, filename, highlight }: CodeBlockProps) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  const highlightSet = useMemo(() => toHighlightSet(highlight), [highlight]);
  const style = theme === 'dark' ? oneDark : oneLight;

  const onCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="border border-border rounded-md overflow-hidden bg-surface">
      {filename && (
        <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-surface-elevated">
          <span className="font-mono text-[12px] text-text-muted">{filename}</span>
          <button
            onClick={onCopy}
            className="h-8 px-3 border border-border rounded-md bg-transparent text-text-primary inline-flex items-center gap-2"
            aria-label="Copy code"
          >
            {copied ? <Check size={16} className="text-success" /> : <Copy size={16} className="text-text-secondary" />}
            <span className="font-mono text-[12px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}

      <div className="text-[13px] leading-6">
        <SyntaxHighlighter
          language={language}
          style={style}
          wrapLines
          showLineNumbers
          customStyle={{
            margin: 0,
            background: 'transparent',
            fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '12px'
          }}
          lineNumberStyle={{
            color: 'rgb(var(--text-muted))',
            minWidth: '2.2em',
            paddingRight: '1em'
          }}
          lineProps={(lineNumber) => {
            const isHighlighted = highlightSet.has(lineNumber);
            return {
              style: isHighlighted ? { background: 'rgb(var(--accent) / 0.10)' } : undefined
            };
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

