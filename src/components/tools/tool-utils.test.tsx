import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UIMessage } from '@/types/agent';
import { renderNestedToolsList } from './tool-utils';

const buildToolCallMessage = (): UIMessage => ({
  id: 'call-1',
  role: 'tool',
  content: [
    {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'bash',
      input: { command: 'ls' },
    },
  ],
  timestamp: new Date('2024-01-01T00:00:00Z'),
  toolCallId: 'call-1',
  toolName: 'bash',
});

const buildToolResultMessage = (): UIMessage => ({
  id: 'result-1',
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'bash',
      output: { type: 'text', value: 'ok' },
    },
  ],
  timestamp: new Date('2024-01-01T00:00:01Z'),
  toolCallId: 'call-1',
  toolName: 'bash',
});

describe('renderNestedToolsList', () => {
  it('renders tool calls stored with tool role', () => {
    const toolCallMessage = buildToolCallMessage();
    const toolResultMessage = buildToolResultMessage();

    render(<div>{renderNestedToolsList([toolCallMessage, toolResultMessage])}</div>);

    expect(screen.getByText('Agent is using tools:')).toBeInTheDocument();
    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.getByText('ls')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('returns null when there are no tool-call contents', () => {
    const toolResultMessage = buildToolResultMessage();
    const { container } = render(<div>{renderNestedToolsList([toolResultMessage])}</div>);

    expect(container.textContent?.trim()).toBe('');
  });
});
