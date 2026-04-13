import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CollapsibleProcessBlock } from './collapsible-process-block';

describe('CollapsibleProcessBlock', () => {
  it('expands while active and auto-collapses after completion', () => {
    const text = 'initial reasoning text that is intentionally longer than the preview length';
    const { rerender } = render(
      <CollapsibleProcessBlock
        text={text}
        isActive
        title="Thinking"
        icon={<span data-testid="icon">icon</span>}
        previewLength={20}
      />
    );

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText('initial reasoning te...')).not.toBeInTheDocument();

    rerender(
      <CollapsibleProcessBlock
        text={text}
        isActive={false}
        title="Thinking"
        icon={<span data-testid="icon">icon</span>}
        previewLength={20}
      />
    );

    expect(screen.getByText('initial reasoning te...')).toBeInTheDocument();
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  });

  it('allows manual toggle while active', () => {
    const text = 'manual toggle text that is longer than the collapsed preview';

    render(
      <CollapsibleProcessBlock
        text={text}
        isActive
        title="Thinking"
        icon={<span data-testid="icon">icon</span>}
        previewLength={12}
      />
    );

    expect(screen.getByText(text)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('manual toggl...')).toBeInTheDocument();
    expect(screen.queryByText(text)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
