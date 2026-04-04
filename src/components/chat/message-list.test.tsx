// src/components/chat/message-list.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StoredToolContent } from '@/types';
import type { UIMessage } from '@/types/agent';
import { MessageList } from './message-list';

// Mock ResizeObserver globally for tests
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// Mock the MessageItem component to simplify testing
vi.mock('@/components/chat/message-item', () => ({
  MessageItem: ({ message }: { message: UIMessage }) => (
    <div data-testid={`message-${message.id}`} data-role={message.role}>
      {message.role === 'tool' && message.toolName && (
        <span data-testid="tool-name">{message.toolName}</span>
      )}
      {message.role === 'tool' && message.toolCallId && (
        <span data-testid="tool-call-id">{message.toolCallId}</span>
      )}
      {typeof message.content === 'string' && (
        <span data-testid="content">{message.content}</span>
      )}
    </div>
  ),
}));

vi.mock('react-window', async () => {
  const ReactModule = await import('react');
  return {
    VariableSizeList: ({ itemCount, itemData, children }: any) => (
      <div>
        {Array.from({ length: itemCount }, (_, index) =>
          children({
            index,
            style: {},
            data: itemData,
          })
        )}
      </div>
    ),
  };
});

describe('MessageList', () => {
  it('should display tool messages with different toolCallIds', () => {
    const messages: UIMessage[] = [
      {
        id: 'tool-1',
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'bashTool',
            input: { command: 'ls' },
            status: 'success',
          } as StoredToolContent,
        ],
        timestamp: new Date(),
        toolCallId: 'call-123',
        toolName: 'bashTool',
      },
      {
        id: 'tool-2',
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-456',
            toolName: 'bashTool',
            input: { command: 'pwd' },
            status: 'success',
          } as StoredToolContent,
        ],
        timestamp: new Date(),
        toolCallId: 'call-456',
        toolName: 'bashTool',
      },
    ];

    render(<MessageList messages={messages} />);

    // Should display both tool messages (different toolCallIds)
    const toolNames = screen.getAllByTestId('tool-name');
    expect(toolNames).toHaveLength(2);
  });

  it('should display all message types correctly', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Hi there',
        timestamp: new Date(),
      },
      {
        id: 'tool-1',
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'bashTool',
            input: { command: 'ls' },
            status: 'success',
          } as StoredToolContent,
        ],
        timestamp: new Date(),
        toolCallId: 'call-123',
        toolName: 'bashTool',
      },
    ];

    render(<MessageList messages={messages} />);

    // All messages should be displayed
    expect(screen.getByTestId('message-user-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-assistant-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-tool-1')).toBeInTheDocument();
  });

  it('should not skip empty messages that have attachments', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: '',
        timestamp: new Date(),
        attachments: [
          {
            id: 'att-1',
            type: 'image',
            filename: 'test.png',
            filePath: '/tmp/test.png',
            mimeType: 'image/png',
            size: 1234,
          },
        ],
      },
    ];

    render(<MessageList messages={messages} />);

    expect(screen.getByTestId('message-user-1')).toBeInTheDocument();
  });

  it('should skip empty messages', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
      {
        id: 'empty-1',
        role: 'assistant',
        content: '', // Empty content
        timestamp: new Date(),
      },
      {
        id: 'whitespace-1',
        role: 'assistant',
        content: '   ', // Only whitespace
        timestamp: new Date(),
      },
    ];

    render(<MessageList messages={messages} />);

    // Only non-empty messages should be displayed
    expect(screen.getByTestId('message-user-1')).toBeInTheDocument();
    expect(screen.queryByTestId('message-empty-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-whitespace-1')).not.toBeInTheDocument();
  });

  it('should filter out tool-call messages when tool-result exists', () => {
    const messages: UIMessage[] = [
      {
        id: 'tool-call-1',
        role: 'tool',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'bashTool',
            input: { command: 'ls' },
          },
        ],
        timestamp: new Date(),
        toolCallId: 'call-123',
        toolName: 'bashTool',
      },
      {
        id: 'tool-result-1',
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'bashTool',
            input: { command: 'ls' },
            status: 'success',
          } as StoredToolContent,
        ],
        timestamp: new Date(),
        toolCallId: 'call-123',
        toolName: 'bashTool',
      },
    ];

    render(<MessageList messages={messages} />);

    // tool-call should be filtered out, only tool-result should be displayed
    expect(screen.queryByTestId('message-tool-call-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('message-tool-result-1')).toBeInTheDocument();
  });
});
