import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UIMessage } from '@/types/agent';
import { formatExternalAgentErrorContent } from '@/lib/external-agent-error';
import { MessageItem } from './message-item';

vi.mock('@/components/chat/collapsible-reasoning', () => ({
  CollapsibleReasoning: () => <div data-testid="reasoning" />,
}));
vi.mock('@/components/chat/file-preview', () => ({
  FilePreview: () => <div data-testid="file-preview" />,
}));
vi.mock('@/components/tools/tool-error-boundary', () => ({
  ToolErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/tools/tool-error-fallback', () => ({
  ToolErrorFallback: () => <div data-testid="tool-error-fallback" />,
}));
vi.mock('@/components/tools/unified-tool-result', () => ({
  UnifiedToolResult: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/tool-adapter', () => ({
  getToolUIRenderers: vi.fn(() => null),
}));
vi.mock('./my-markdown', () => ({
  default: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));
vi.mock('./web-content-renderer', () => ({
  WebContentRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

describe('MessageItem', () => {
  it('renders external agent failure as an execution failure card', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: formatExternalAgentErrorContent({
        backend: 'codex',
        message: '文件名、目录名或卷标语法不正确。 (os error 123)',
      }),
      timestamp: new Date(),
    };

    render(<MessageItem message={message} isLastAssistantInTurn />);

    expect(screen.getByText('执行失败 · codex')).toBeInTheDocument();
    expect(screen.getByText('文件名、目录名或卷标语法不正确。 (os error 123)')).toBeInTheDocument();
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
  });
});
