import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FileDiffPreview } from './file-diff-preview';

// Mock useSettingsStore to return English language
vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: (selector: (state: { language: string; getAutoApproveEditsGlobal: () => boolean }) => string) =>
    selector({
      language: 'en',
      getAutoApproveEditsGlobal: () => false,
      setAutoApproveEditsGlobal: vi.fn(),
    }),
}));

// Helper function to test diff generation (extracted for testing)
function generateDiff(original: string, modified: string): any[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const _diff: any[] = [];

  // Use a simple LCS (Longest Common Subsequence) algorithm for better diff
  const lcs = computeLCS(originalLines, modifiedLines);

  // Build diff from LCS
  let originalIndex = 0;
  let modifiedIndex = 0;
  const fullDiff: any[] = [];

  for (const line of lcs) {
    // Add removed lines
    while (originalIndex < line.originalIndex) {
      fullDiff.push({
        type: 'removed',
        content: originalLines[originalIndex],
        originalLineNumber: originalIndex + 1,
      });
      originalIndex++;
    }

    // Add added lines
    while (modifiedIndex < line.modifiedIndex) {
      fullDiff.push({
        type: 'added',
        content: modifiedLines[modifiedIndex],
        newLineNumber: modifiedIndex + 1,
      });
      modifiedIndex++;
    }

    // Add the matching line
    fullDiff.push({
      type: 'unchanged',
      content: line.content,
      originalLineNumber: line.originalIndex + 1,
      newLineNumber: line.modifiedIndex + 1,
    });
    originalIndex++;
    modifiedIndex++;
  }

  // Add remaining lines from original (removed)
  while (originalIndex < originalLines.length) {
    fullDiff.push({
      type: 'removed',
      content: originalLines[originalIndex],
      originalLineNumber: originalIndex + 1,
    });
    originalIndex++;
  }

  // Add remaining lines from modified (added)
  while (modifiedIndex < modifiedLines.length) {
    fullDiff.push({
      type: 'added',
      content: modifiedLines[modifiedIndex],
      newLineNumber: modifiedIndex + 1,
    });
    modifiedIndex++;
  }

  // For testing, return simplified full diff
  return fullDiff;
}

interface LCSLine {
  content: string;
  originalIndex: number;
  modifiedIndex: number;
}

function computeLCS(originalLines: string[], modifiedLines: string[]): LCSLine[] {
  const m = originalLines.length;
  const n = modifiedLines.length;

  // Create DP table for LCS
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalLines[i - 1] === modifiedLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: LCSLine[] = [];
  let i = m,
    j = n;

  while (i > 0 && j > 0) {
    if (originalLines[i - 1] === modifiedLines[j - 1]) {
      lcs.unshift({
        content: originalLines[i - 1],
        originalIndex: i - 1,
        modifiedIndex: j - 1,
      });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

describe('FileDiffPreview Component', () => {
  const defaultProps = {
    filePath: '/test/example.js',
    originalContent: 'function test() {\n  return true;\n}',
    newContent: 'function test() {\n  return false;\n}',
    operation: 'edit' as const,
    onApprove: vi.fn(),
    onReject: vi.fn(),
  };

  it('should render file information correctly', () => {
    render(<FileDiffPreview {...defaultProps} />);

    expect(screen.getByText('File Edit Preview')).toBeInTheDocument();
    expect(screen.getByText('example.js')).toBeInTheDocument();
    expect(screen.getByText('/test/example.js')).toBeInTheDocument();
  });

  it('should show diff with added and removed lines', () => {
    render(<FileDiffPreview {...defaultProps} />);

    // Should show the changes
    expect(screen.getByText('Changes')).toBeInTheDocument();

    // Look for diff indicators
    const diffContainer = screen.getByText('Changes').parentElement?.parentElement;
    expect(diffContainer).toContainHTML('return true');
    expect(diffContainer).toContainHTML('return false');
  });

  it('should display correct badge counts for changes', () => {
    render(<FileDiffPreview {...defaultProps} />);

    // Should show 1 removal and 1 addition
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('should call onApprove when approve button is clicked', () => {
    const onApprove = vi.fn();
    render(<FileDiffPreview {...defaultProps} onApprove={onApprove} />);

    const approveButton = screen.getByRole('button', { name: /^approve$/i });
    fireEvent.click(approveButton);

    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('should show feedback textarea by default', () => {
    render(<FileDiffPreview {...defaultProps} />);

    // Feedback textarea should be visible by default
    expect(screen.getByPlaceholderText(/describe what changes/i)).toBeInTheDocument();
  });

  it('should call onReject with feedback when feedback is submitted', () => {
    const onReject = vi.fn();
    render(<FileDiffPreview {...defaultProps} onReject={onReject} />);

    // Type feedback
    const feedbackTextarea = screen.getByPlaceholderText(/describe what changes/i);
    fireEvent.change(feedbackTextarea, { target: { value: 'Please use null instead of false' } });

    // Submit feedback
    const submitButton = screen.getByRole('button', { name: /submit feedback/i });
    fireEvent.click(submitButton);

    expect(onReject).toHaveBeenCalledWith('Please use null instead of false');
  });

  it('should disable submit feedback button when no feedback is provided', () => {
    render(<FileDiffPreview {...defaultProps} />);

    // Submit button should be disabled when no feedback
    const submitButton = screen.getByRole('button', { name: /submit feedback/i });
    expect(submitButton).toBeDisabled();
  });

  it('should show Allow All button when onAllowAll callback is provided', () => {
    const onAllowAll = vi.fn();
    render(<FileDiffPreview {...defaultProps} onAllowAll={onAllowAll} />);

    const allowAllButton = screen.getByRole('button', { name: /allow all edits in this task/i });
    expect(allowAllButton).toBeInTheDocument();

    fireEvent.click(allowAllButton);
    expect(onAllowAll).toHaveBeenCalledTimes(1);
  });

  it('should not show Allow All button when onAllowAll callback is not provided', () => {
    render(<FileDiffPreview {...defaultProps} />);

    const allowAllButton = screen.queryByRole('button', { name: /allow all edits in this task/i });
    expect(allowAllButton).not.toBeInTheDocument();
  });

  it('should handle write operation correctly', () => {
    render(<FileDiffPreview {...defaultProps} operation="write" />);

    expect(screen.getByText('File Write Preview')).toBeInTheDocument();
  });
});

describe('Diff Algorithm Tests', () => {
  it('should group consecutive deletions together', () => {
    const original = `line 1
line 2
line 3
line 4
line 5`;

    const modified = `line 1
line 3
line 4
line 5`;

    const diff = generateDiff(original, modified);

    // Should show consecutive deletion as group
    const removalIndices = diff
      .map((line, idx) => (line.type === 'removed' ? idx : -1))
      .filter((idx) => idx !== -1);
    expect(removalIndices.length).toBe(1); // Only one removal entry

    // The removal should contain "line 2"
    const removedLine = diff.find((line) => line.type === 'removed');
    expect(removedLine?.content).toBe('line 2');
  });

  it('should group consecutive additions together', () => {
    const original = `line 1
line 4
line 5`;

    const modified = `line 1
line 2
line 3
line 4
line 5`;

    const diff = generateDiff(original, modified);

    // Should show consecutive additions as group
    const additionIndices = diff
      .map((line, idx) => (line.type === 'added' ? idx : -1))
      .filter((idx) => idx !== -1);
    expect(additionIndices.length).toBe(2); // Two addition entries

    // Should add line 2 then line 3 (consecutive)
    const additions = diff.filter((line) => line.type === 'added');
    expect(additions[0].content).toBe('line 2');
    expect(additions[1].content).toBe('line 3');
  });

  it('should show deletions before additions in change blocks', () => {
    const original = `function hello() {
  console.log("Hello");
  return "world";
}`;

    const modified = `function hello() {
  console.log("Hello, world!");
  return "universe";
}`;

    const diff = generateDiff(original, modified);

    // Find the indices of removed and added lines
    const removedIndex = diff.findIndex((line) => line.type === 'removed');
    const addedIndex = diff.findIndex((line) => line.type === 'added');

    // Removed should come before added
    expect(removedIndex).toBeLessThan(addedIndex);

    // Check specific content
    const removedLine = diff[removedIndex];
    const addedLine = diff[addedIndex];

    expect(removedLine?.content).toBe('  console.log("Hello");');
    expect(addedLine?.content).toBe('  console.log("Hello, world!");');
  });

  it('should handle mixed consecutive changes correctly', () => {
    const original = `line 1
line 2
line 3
line 4
line 5`;

    const modified = `line 1
new line 2a
new line 2b
line 3
new line 4a
new line 4b
line 5`;

    const diff = generateDiff(original, modified);

    // Should show pattern: line 1 (unchanged), then deletion, then additions, then line 3, then deletion, then additions, then line 5
    const types = diff.map((line) => line.type);

    // Should show deletions before additions, and group consecutive additions
    expect(types).toEqual([
      'unchanged', // line 1
      'removed', // line 2 (being replaced)
      'added', // new line 2a
      'added', // new line 2b
      'unchanged', // line 3
      'removed', // line 4 (being replaced)
      'added', // new line 4a
      'added', // new line 4b
      'unchanged', // line 5
    ]);

    // Verify that additions are grouped together
    const additionGroups = [];
    let currentGroup = [];

    for (const line of diff) {
      if (line.type === 'added') {
        currentGroup.push(line);
      } else {
        if (currentGroup.length > 0) {
          additionGroups.push(currentGroup);
          currentGroup = [];
        }
      }
    }
    if (currentGroup.length > 0) {
      additionGroups.push(currentGroup);
    }

    // Should have two groups of consecutive additions
    expect(additionGroups).toHaveLength(2);
    expect(additionGroups[0]).toHaveLength(2); // new line 2a, new line 2b
    expect(additionGroups[1]).toHaveLength(2); // new line 4a, new line 4b
  });
});
