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
  getToolUIRenderers: vi.fn((toolName: string) => {
    if (toolName !== 'callAgent') {
      return null;
    }

    return {
      renderToolDoing: (input: { nestedTools?: UIMessage[] }) => {
        const nestedTools = input.nestedTools || [];
        const lastNestedMessage = nestedTools[nestedTools.length - 1];
        const nestedContent = Array.isArray(lastNestedMessage?.content)
          ? JSON.stringify(lastNestedMessage.content)
          : 'none';

        return (
          <div data-testid="call-agent-doing">
            nested-count:{nestedTools.length};nested-content:{nestedContent}
          </div>
        );
      },
      renderToolResult: () => <div data-testid="call-agent-result" />,
    };
  }),
}));
vi.mock('./my-markdown', () => ({
  default: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));
vi.mock('./web-content-renderer', () => ({
  WebContentRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));
vi.mock('@/components/chat/review-result-card', () => ({
  ReviewResultCard: ({ content }: { content: string }) => (
    <div data-testid="review-result-card">{content}</div>
  ),
  isAutoReviewContent: (content: string) => /review summary/i.test(content),
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

  it('renders auto review results inside collapsed review card wrapper', () => {
    const reviewText = `# 代码审查报告\n\n## REVIEW SUMMARY\n发现 1 个问题\n\n## CRITICAL ISSUES (Blockers)\nNone found.\n\n## MAJOR ISSUES (Required Changes)\n- 修复空值判断`;

    const message: UIMessage = {
      id: 'assistant-review-1',
      role: 'assistant',
      content: reviewText,
      timestamp: new Date(),
    };

    render(<MessageItem message={message} isLastAssistantInTurn />);

    expect(screen.getByTestId('review-result-card')).toBeInTheDocument();
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
  });

  it('rerenders tool messages when nested tool updates arrive', () => {
    const message: UIMessage = {
      id: 'tool-1',
      role: 'tool',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', task: 'debug issue' },
        },
      ],
      timestamp: new Date(),
      renderDoingUI: true,
      taskId: 'task-1',
      nestedTools: [
        {
          id: 'nested-1',
          role: 'tool',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'nested-call-1',
              toolName: 'readFile',
              input: { file_path: 'a.ts' },
            },
          ],
          timestamp: new Date(),
          parentToolCallId: 'call-1',
          renderDoingUI: true,
        },
      ],
    };

    const { rerender } = render(<MessageItem message={message} isLastAssistantInTurn />);

    expect(screen.getByTestId('call-agent-doing')).toHaveTextContent('nested-count:1');
    expect(screen.getByTestId('call-agent-doing')).toHaveTextContent('tool-call');

    const updatedMessage: UIMessage = {
      ...message,
      nestedTools: [
        {
          id: 'nested-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'nested-call-1',
              toolName: 'readFile',
              input: { file_path: 'a.ts' },
              output: { success: true, content: 'done' },
            },
          ],
          timestamp: new Date(),
          parentToolCallId: 'call-1',
          renderDoingUI: true,
        },
      ],
    };

    rerender(<MessageItem message={updatedMessage} isLastAssistantInTurn />);

    expect(screen.getByTestId('call-agent-doing')).toHaveTextContent('nested-count:1');
    expect(screen.getByTestId('call-agent-doing')).toHaveTextContent('tool-result');
    expect(screen.getByTestId('call-agent-doing')).toHaveTextContent('done');
  });

});

