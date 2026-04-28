import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewResultCard, isAutoReviewContent } from './review-result-card';

vi.mock('./my-markdown', () => ({
  default: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

describe('review-result-card', () => {
  it('detects auto review content by expected section headers', () => {
    expect(
      isAutoReviewContent('## REVIEW SUMMARY\ntext\n\n## CRITICAL ISSUES (Blockers)\nNone found.')
    ).toBe(true);
    expect(isAutoReviewContent('普通回复内容')).toBe(false);
  });

  it('is collapsed by default and expands on click', () => {
    const content = `# 代码审查报告\n\n## REVIEW SUMMARY\n摘要\n\n## CRITICAL ISSUES (Blockers)\n无\n\n## MAJOR ISSUES (Required Changes)\n- 项目 A`;

    render(<ReviewResultCard content={content} />);

    expect(screen.getByText('代码审查结果')).toBeInTheDocument();
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getAllByTestId('markdown').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: /review summary/i })).toBeInTheDocument();
  });
});
