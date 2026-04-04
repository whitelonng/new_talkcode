// src/components/chat/web-content-renderer.tsx

import { useMemo, useState } from 'react';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';

interface WebContentRendererProps {
  content: string;
  className?: string;
}

const TAILWIND_CDN_SCRIPT = '<script src="https://cdn.tailwindcss.com"></script>';

const BASE_STYLE = `
  <style>
    :root { color-scheme: light dark; }
    html, body { margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; line-height: 1.5; }
    body { background: #ffffff; color: #0f172a; }
    @media (prefers-color-scheme: dark) {
      body { background: #0b0f1a; color: #e2e8f0; }
    }
    img, video { max-width: 100%; height: auto; }
  </style>
`;

function stripHtmlCodeFence(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('```html')) {
    const withoutStart = trimmed.replace(/^```html\s*/i, '');
    return withoutStart.replace(/```\s*$/, '').trim();
  }
  if (trimmed.startsWith('```')) {
    const withoutStart = trimmed.replace(/^```\s*/i, '');
    return withoutStart.replace(/```\s*$/, '').trim();
  }
  return trimmed;
}

function buildHtmlDocument(rawHtml: string): string {
  const headInjection = `${BASE_STYLE}${TAILWIND_CDN_SCRIPT}`;
  if (/<!doctype\s+html>/i.test(rawHtml) || /<html\b/i.test(rawHtml)) {
    if (/<head\b/i.test(rawHtml)) {
      return rawHtml.replace(/<head\b[^>]*>/i, (match) => `${match}${headInjection}`);
    }
    return rawHtml.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${headInjection}</head>`);
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${headInjection}
  </head>
  <body>
    ${rawHtml}
  </body>
</html>`;
}

export function WebContentRenderer({ content, className }: WebContentRendererProps) {
  const { t } = useLocale();
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');

  const rawHtml = useMemo(() => stripHtmlCodeFence(content), [content]);
  const isSafeHtml = useMemo(() => {
    const lowered = rawHtml.toLowerCase();
    return !lowered.includes('<script') && !lowered.includes('javascript:');
  }, [rawHtml]);
  const renderedHtml = useMemo(() => buildHtmlDocument(rawHtml), [rawHtml]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'rendered' ? 'source' : 'rendered')}
          className="ml-auto px-2 py-1 text-xs rounded border border-border bg-muted hover:bg-muted/80"
        >
          {viewMode === 'rendered'
            ? t.Chat.outputFormat.viewSource
            : t.Chat.outputFormat.viewRendered}
        </button>
      </div>
      {viewMode === 'rendered' && isSafeHtml ? (
        <div className="border rounded bg-background overflow-hidden">
          <iframe
            className="w-full h-[360px]"
            sandbox=""
            srcDoc={renderedHtml}
            title="Web content preview"
          />
        </div>
      ) : (
        <pre className="p-3 bg-muted rounded text-xs overflow-auto border border-border whitespace-pre-wrap">
          {rawHtml}
        </pre>
      )}
    </div>
  );
}
