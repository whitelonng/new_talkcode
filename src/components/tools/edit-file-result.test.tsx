import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditFileResult } from './edit-file-result';

// Mock the Badge component if needed, or just let it render
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className}>{children}</span>,
}));

describe('EditFileResult Component', () => {
  const filePath = 'test-file.ts';

  it('should render diff for small files', () => {
    const original = 'line 1\nline 2\nline 3';
    const modified = 'line 1\nline 2 changed\nline 3';

    render(
      <EditFileResult
        filePath={filePath}
        originalContent={original}
        newContent={modified}
      />
    );

    expect(screen.getByText('test-file.ts')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('line 2')).toBeInTheDocument();
    expect(screen.getByText('line 2 changed')).toBeInTheDocument();
  });

  it('should show diff for large files with small modifications (Bug Fix Coverage)', () => {
    // Create a large file (> 2000 lines)
    const prefix = Array(2100).fill('common prefix').join('\n');
    const suffix = Array(100).fill('common suffix').join('\n');
    
    const original = `${prefix}\noriginal line\n${suffix}`;
    const modified = `${prefix}\nmodified line\n${suffix}`;

    render(
      <EditFileResult
        filePath={filePath}
        originalContent={original}
        newContent={modified}
      />
    );

    // It should NOT show "File too large"
    expect(screen.queryByText(/File too large/)).not.toBeInTheDocument();
    
    // It should show the actual diff
    expect(screen.getByText('original line')).toBeInTheDocument();
    expect(screen.getByText('modified line')).toBeInTheDocument();
    
    // Header badges should show correct counts
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('should show "File too large" message when the modification itself is too large', () => {
    // Create a modification that exceeds MAX_LINES_FOR_DIFF (2000)
    const originalPart = Array(2100).fill('removed line').join('\n');
    const modifiedPart = Array(2100).fill('added line').join('\n');
    
    const original = originalPart;
    const modified = modifiedPart;

    render(
      <EditFileResult
        filePath={filePath}
        originalContent={original}
        newContent={modified}
      />
    );

    // It SHOULD show "File too large"
    expect(screen.getByText(/File too large for detailed diff view/)).toBeInTheDocument();
    expect(screen.getByText(/Diff computation skipped/)).toBeInTheDocument();
    
    // It should still show estimated counts in the header
    // In our code: Math.max(0, originalLineCount - newLineCount)
    // Since counts are equal, badges might not show or show 0
  });

  it('should correctly handle removals at the end of large files', () => {
    const prefix = Array(2050).fill('line').join('\n');
    const original = `${prefix}\nline to delete 1\nline to delete 2`;
    const modified = prefix;

    render(
      <EditFileResult
        filePath={filePath}
        originalContent={original}
        newContent={modified}
      />
    );

    expect(screen.queryByText(/File too large/)).not.toBeInTheDocument();
    expect(screen.getByText('line to delete 1')).toBeInTheDocument();
    expect(screen.getByText('line to delete 2')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
  });
});
