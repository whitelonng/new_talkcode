import { ChevronDown, ChevronRight, FileSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MyMarkdown from './my-markdown';

interface ReviewResultCardProps {
  content: string;
}

function stripMarkdownHeadingMarkers(line: string): string {
  return line.replace(/^#{1,6}\s*/, '').trim();
}

export function isAutoReviewContent(content: string): boolean {
  const normalized = content.trim();
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  return (
    lower.includes('review summary') &&
    (lower.includes('critical issues') || lower.includes('major issues'))
  );
}

export function ReviewResultCard({ content }: ReviewResultCardProps) {
  const [open, setOpen] = useState(false);

  const sections = useMemo(() => {
    const lines = content.split(/\r?\n/);
    const summaryIndex = lines.findIndex((line) => /review summary/i.test(line));
    const criticalIndex = lines.findIndex((line) => /critical issues/i.test(line));
    const majorIndex = lines.findIndex((line) => /major issues/i.test(line));

    const indices = [
      { key: 'summary', label: 'Summary', index: summaryIndex },
      { key: 'critical', label: 'Critical', index: criticalIndex },
      { key: 'major', label: 'Major', index: majorIndex },
    ].filter((item) => item.index >= 0);

    if (indices.length === 0) {
      return [
        {
          key: 'full',
          label: 'Review',
          content,
        },
      ];
    }

    const sorted = [...indices].sort((a, b) => a.index - b.index);

    return sorted.map((item, idx) => {
      const start = item.index;
      const end = idx + 1 < sorted.length ? sorted[idx + 1]?.index ?? lines.length : lines.length;
      const sectionLines = lines.slice(start, end).join('\n').trim();
      const titleLine = lines[start] || item.label;

      return {
        key: item.key,
        label: stripMarkdownHeadingMarkers(titleLine) || item.label,
        content: sectionLines,
      };
    });
  }, [content]);

  const defaultTab = sections[0]?.key ?? 'full';

  return (
    <div className="my-3 rounded-xl border border-border bg-card/80 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <FileSearch className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">代码审查结果</div>
          <div className="truncate text-muted-foreground text-xs">
            已折叠显示，点击展开查看详细 review 内容
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <Tabs defaultValue={defaultTab} className="gap-3">
            <TabsList className="h-auto w-full justify-start overflow-x-auto">
              {sections.map((section) => (
                <TabsTrigger key={section.key} value={section.key} className="shrink-0">
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {sections.map((section) => (
              <TabsContent key={section.key} value={section.key} className="m-0">
                <div className="assistant-markdown prose prose-neutral dark:prose-invert w-full max-w-none">
                  <MyMarkdown content={section.content} />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
}
