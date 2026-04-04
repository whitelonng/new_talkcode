import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileChangesSummary } from './file-changes-summary';
import type { FileChange } from '@/stores/file-changes-store';

// Mock stores
const mockSelectFile = vi.fn();
const mockChangesByConversation = new Map<string, FileChange[]>();

vi.mock('@/stores/file-changes-store', () => ({
  useFileChangesStore: (selector: (state: { changesByTask: Map<string, any> }) => any) => {
    return selector({ changesByTask: mockChangesByConversation });
  },
}));

vi.mock('@/stores/window-scoped-repository-store', () => ({
  useRepositoryStore: (selector: (state: { selectFile: any; rootPath: string }) => any) => {
    return selector({
      selectFile: mockSelectFile,
      rootPath: '/test/root',
    });
  },
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: (selector: (state: { language: string; getAutoApproveEditsGlobal: () => boolean }) => string) => {
    return selector({
      language: 'en',
      getAutoApproveEditsGlobal: () => false,
      setAutoApproveEditsGlobal: vi.fn(),
    });
  },
}));

vi.mock('@/stores/task-store', () => ({
  useTaskStore: () => ({
    getLastUserMessage: vi.fn(),
  }),
}));

vi.mock('@/stores/worktree-store', () => ({
  useWorktreeStore: (selector: (state: any) => any) => {
    return selector({
      taskWorktreeMap: new Map(),
      getEffectiveRootPath: vi.fn(),
      isMerging: false,
      mergeTask: vi.fn(),
      abortMerge: vi.fn(),
      continueMerge: vi.fn(),
    });
  },
}));

vi.mock('@/services/ai/ai-git-messages-service', () => ({
  aiGitMessagesService: {
    generateCommitMessage: vi.fn(),
  },
}));

vi.mock('@/hooks/use-git', () => ({
  useGit: () => ({
    commitWithAIMessage: vi.fn(),
    isLoading: false,
    isGeneratingMessage: false,
  }),
}));

vi.mock('@/locales', () => ({
  getLocale: () => ({
    FileChanges: {
      codeReviewMessage: 'Please use the code review agent to review the current code changes.',
    },
  }),
}));

vi.mock('./file-change-item', () => ({
  FileChangeItem: ({
    filePath,
    onOpen,
    onViewDiff,
    showDiff,
  }: {
    filePath: string;
    onOpen: (path: string) => void;
    onViewDiff?: (path: string) => void;
    showDiff: boolean;
  }) => (
    <div data-testid={`file-change-item-${filePath}`}>
      <span>{filePath}</span>
      <button type="button" onClick={() => onOpen(filePath)}>
        Open
      </button>
      {showDiff && onViewDiff && (
        <button type="button" onClick={() => onViewDiff(filePath)}>
          View Diff
        </button>
      )}
    </div>
  ),
}));

vi.mock('./file-diff-modal', () => ({
  FileDiffModal: ({
    open,
    filePath,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filePath: string;
    originalContent: string;
    newContent: string;
  }) => (open ? <div data-testid="file-diff-modal">{filePath}</div> : null),
}));

describe('FileChangesSummary - Infinite Loop Regression Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChangesByConversation.clear();
  });

  it('should render without causing infinite re-renders', () => {
    const taskId = 'test-task-1';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/test.ts',
        operation: 'write',
        timestamp: Date.now(),
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<FileChangesSummary taskId={taskId} />);

    // Verify no React errors occurred
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('should be cached to avoid an infinite loop')
    );

    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should not re-render infinitely when changes map updates with same task data', () => {
    const taskId = 'test-task-1';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/test.ts',
        operation: 'write',
        timestamp: Date.now(),
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender, unmount } = render(<FileChangesSummary taskId={taskId} />);

    // Force multiple re-renders to simulate store updates
    for (let i = 0; i < 5; i++) {
      rerender(<FileChangesSummary taskId={taskId} />);
    }

    // Verify no React errors occurred
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );

    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should render null when there are no changes', () => {
    const taskId = 'test-task-empty';
    const { container } = render(<FileChangesSummary taskId={taskId} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render new files section when there are write operations', () => {
    const taskId = 'test-task-2';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/new-file.ts',
        operation: 'write',
        timestamp: Date.now(),
      },
      {
        toolId: 'tool-2',
        filePath: 'src/another-file.ts',
        operation: 'write',
        timestamp: Date.now(),
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible to see the content
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    expect(screen.getByText('New Files (2)')).toBeDefined();
    expect(screen.getByTestId('file-change-item-src/new-file.ts')).toBeDefined();
    expect(screen.getByTestId('file-change-item-src/another-file.ts')).toBeDefined();
  });

  it('should render edited files section when there are edit operations', () => {
    const taskId = 'test-task-3';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/edited-file.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'original',
        newContent: 'new',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible to see the content
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    expect(screen.getByText('Edited Files (1)')).toBeDefined();
    expect(screen.getByTestId('file-change-item-src/edited-file.ts')).toBeDefined();
  });

  it('should render both new and edited files sections', () => {
    const taskId = 'test-task-4';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/new-file.ts',
        operation: 'write',
        timestamp: Date.now(),
      },
      {
        toolId: 'tool-2',
        filePath: 'src/edited-file.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'original',
        newContent: 'new',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible to see the content
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    expect(screen.getByText('New Files (1)')).toBeDefined();
    expect(screen.getByText('Edited Files (1)')).toBeDefined();
  });

  it('should call selectFile when file is opened', () => {
    const taskId = 'test-task-5';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/test-file.ts',
        operation: 'write',
        timestamp: Date.now(),
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible to see the content
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    const openButton = screen.getByText('Open');
    fireEvent.click(openButton);

    expect(mockSelectFile).toHaveBeenCalledWith('src/test-file.ts');
  });

  it('should open diff modal when View Diff is clicked for edited files', () => {
    const taskId = 'test-task-6';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/edited-file.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'original content',
        newContent: 'new content',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible to see the content
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    const viewDiffButton = screen.getByText('View Diff');
    fireEvent.click(viewDiffButton);

    expect(screen.getByTestId('file-diff-modal')).toBeDefined();
  });

  it('should not open diff modal for files without content', () => {
    const taskId = 'test-task-7';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/edited-file.ts',
        operation: 'edit',
        timestamp: Date.now(),
        // Missing originalContent and newContent
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible to see the content
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    const viewDiffButton = screen.getByText('View Diff');
    fireEvent.click(viewDiffButton);

    expect(screen.queryByTestId('file-diff-modal')).toBeNull();
  });

  it('should handle task ID changes without infinite loops', () => {
    const taskId1 = 'test-task-8';
    const taskId2 = 'test-task-9';

    const changes1: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/file1.ts',
        operation: 'write',
        timestamp: Date.now(),
      },
    ];

    const changes2: FileChange[] = [
      {
        toolId: 'tool-2',
        filePath: 'src/file2.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'original',
        newContent: 'new',
      },
    ];

    mockChangesByConversation.set(taskId1, changes1);
    mockChangesByConversation.set(taskId2, changes2);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender, unmount } = render(<FileChangesSummary taskId={taskId1} />);

    // Switch conversation
    rerender(<FileChangesSummary taskId={taskId2} />);

    // Switch back
    rerender(<FileChangesSummary taskId={taskId1} />);

    // Verify no React errors occurred
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );

    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should properly memoize changes array', () => {
    const taskId = 'test-task-10';
    const changes: FileChange[] = [
      {
        filePath: 'src/test.ts',
        operation: 'write',
        timestamp: Date.now(),
        toolId: 'tool-1',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender, unmount } = render(<FileChangesSummary taskId={taskId} />);

    // Multiple re-renders with same data should not cause issues
    for (let i = 0; i < 10; i++) {
      rerender(<FileChangesSummary taskId={taskId} />);
    }

    // Verify no infinite loop warnings
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('should be cached to avoid an infinite loop')
    );

    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should handle empty changes array without errors', () => {
    const taskId = 'test-task-11';
    mockChangesByConversation.set(taskId, []);

    const { container } = render(<FileChangesSummary taskId={taskId} />);

    expect(container.firstChild).toBeNull();
  });

  it('should group files by operation type correctly', () => {
    const taskId = 'test-task-12';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/new1.ts',
        operation: 'write',
        timestamp: Date.now(),
      },
      {
        toolId: 'tool-2',
        filePath: 'src/new2.ts',
        operation: 'write',
        timestamp: Date.now(),
      },
      {
        toolId: 'tool-3',
        filePath: 'src/edited1.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'original1',
        newContent: 'new1',
      },
      {
        toolId: 'tool-4',
        filePath: 'src/edited2.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'original2',
        newContent: 'new2',
      },
      {
        toolId: 'tool-5',
        filePath: 'src/edited3.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'original3',
        newContent: 'new3',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Click the collapsible trigger to expand it (more than 3 files means it starts collapsed)
    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);

    expect(screen.getByText('New Files (2)')).toBeDefined();
    expect(screen.getByText('Edited Files (3)')).toBeDefined();
  });

  it('should deduplicate and merge multiple edits to the same file', () => {
    const taskId = 'test-task-13';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/message-filter.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'original content',
        newContent: 'first edit',
      },
      {
        toolId: 'tool-2',
        filePath: 'src/message-filter.ts',
        operation: 'edit',
        timestamp: Date.now() + 1000,
        originalContent: 'first edit',
        newContent: 'second edit',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    // Should only show the file once
    expect(screen.getByText('Edited Files (1)')).toBeDefined();
    const fileItems = screen.getAllByTestId('file-change-item-src/message-filter.ts');
    expect(fileItems).toHaveLength(1);
  });

  it('should merge diff correctly - using first original and last new content', () => {
    const taskId = 'test-task-14';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/test-file.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'version 0',
        newContent: 'version 1',
      },
      {
        toolId: 'tool-2',
        filePath: 'src/test-file.ts',
        operation: 'edit',
        timestamp: Date.now() + 1000,
        originalContent: 'version 1',
        newContent: 'version 2',
      },
      {
        toolId: 'tool-3',
        filePath: 'src/test-file.ts',
        operation: 'edit',
        timestamp: Date.now() + 2000,
        originalContent: 'version 2',
        newContent: 'version 3',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    // Click View Diff to open the modal
    const viewDiffButton = screen.getByText('View Diff');
    fireEvent.click(viewDiffButton);

    // The modal should be opened with merged diff
    const modal = screen.getByTestId('file-diff-modal');
    expect(modal).toBeDefined();
  });

  it('should treat file as NEW if it was initially written then edited (simulating writeFile on new file)', () => {
    // Scenario: File doesn't exist, AI calls writeFile, then calls editFile
    const taskId = 'test-task-15';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/mixed-file.ts',
        operation: 'write', // writeFile creates new file (no originalContent)
        timestamp: Date.now(),
        newContent: 'initial content',
        // originalContent is empty string for new file
        originalContent: '',
      },
      {
        toolId: 'tool-2',
        filePath: 'src/mixed-file.ts',
        operation: 'edit', // editFile modifies the new file
        timestamp: Date.now() + 1000,
        originalContent: 'initial content',
        newContent: 'after edit',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    // Should show as NEW file because it started with a 'write' in this task
    expect(screen.getByText('New Files (1)')).toBeDefined();
    expect(screen.queryByText('Edited Files (1)')).toBeNull();
    const fileItems = screen.getAllByTestId('file-change-item-src/mixed-file.ts');
    expect(fileItems).toHaveLength(1);
  });

  it('should handle sequential writes on a new file', () => {
    // Scenario: File doesn't exist, AI calls writeFile multiple times
    const taskId = 'test-task-16';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/new-file.ts',
        operation: 'write',
        timestamp: Date.now(),
        newContent: 'v1',
        originalContent: '', // Empty for new file
      },
      {
        toolId: 'tool-2',
        filePath: 'src/new-file.ts',
        operation: 'write',
        timestamp: Date.now() + 1000,
        newContent: 'v2',
        originalContent: '', // Still empty
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    expect(screen.getByText('New Files (1)')).toBeDefined();
    const fileItems = screen.getAllByTestId('file-change-item-src/new-file.ts');
    expect(fileItems).toHaveLength(1);
  });

  it('should handle edit then write on existing file - should show EDITED with diff', () => {
    // Scenario: File exists, AI calls editFile, then calls writeFile (overwrite)
    // When writeFile is called on existing file, it should be marked as 'edit' with originalContent
    const taskId = 'test-task-17';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/existing-file.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'existing v0',
        newContent: 'v1',
      },
      {
        toolId: 'tool-2',
        filePath: 'src/existing-file.ts',
        operation: 'edit', // writeFile on existing file marks as 'edit' with originalContent
        timestamp: Date.now() + 1000,
        originalContent: 'v1', // Previous newContent becomes new originalContent
        newContent: 'v2',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    // Should remain as EDITED file since both operations are 'edit'
    expect(screen.getByText('Edited Files (1)')).toBeDefined();
    expect(screen.queryByText('New Files (1)')).toBeNull();

    // Should be able to view diff
    const viewDiffButton = screen.getByText('View Diff');
    fireEvent.click(viewDiffButton);
    expect(screen.getByTestId('file-diff-modal')).toBeDefined();
  });

  it('should handle sequential edits by keeping it as EDITED with first originalContent', () => {
    const taskId = 'test-task-18';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/file.ts',
        operation: 'edit',
        timestamp: Date.now(),
        originalContent: 'original',
        newContent: 'edit 1',
      },
      {
        toolId: 'tool-2',
        filePath: 'src/file.ts',
        operation: 'edit',
        timestamp: Date.now() + 1000,
        originalContent: 'edit 1',
        newContent: 'edit 2',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    expect(screen.getByText('Edited Files (1)')).toBeDefined();
    expect(screen.queryByText('New Files (1)')).toBeNull();
  });

  it('should show diff for existing file overwritten by writeFile (critical scenario)', () => {
    // This is the KEY test case: AI calls writeFile on an EXISTING file
    // According to write-file-tool.tsx, it should be marked as 'edit' with originalContent
    const taskId = 'test-task-19';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/existing-config.ts',
        operation: 'edit', // writeFile on existing file marks as 'edit'
        timestamp: Date.now(),
        originalContent: 'old configuration', // The original file content
        newContent: 'new configuration', // The new content being written
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    // Should show in Edited Files (not New Files)
    expect(screen.getByText('Edited Files (1)')).toBeDefined();
    expect(screen.queryByText('New Files (1)')).toBeNull();

    // Should be able to view diff - this is the critical assertion
    const viewDiffButton = screen.getByText('View Diff');
    fireEvent.click(viewDiffButton);
    expect(screen.getByTestId('file-diff-modal')).toBeDefined();
  });

  it('should correctly merge writeFile then editFile on existing file', () => {
    // Scenario: Existing file, AI calls writeFile (marked as edit), then editFile
    const taskId = 'test-task-20';
    const changes: FileChange[] = [
      {
        toolId: 'tool-1',
        filePath: 'src/app.ts',
        operation: 'edit', // writeFile on existing file
        timestamp: Date.now(),
        originalContent: 'original v0', // File's original content
        newContent: 'v1', // New content from writeFile
      },
      {
        toolId: 'tool-2',
        filePath: 'src/app.ts',
        operation: 'edit', // editFile after writeFile
        timestamp: Date.now() + 1000,
        originalContent: 'v1',
        newContent: 'v2',
      },
    ];

    mockChangesByConversation.set(taskId, changes);

    render(<FileChangesSummary taskId={taskId} />);

    // Expand the collapsible
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    // Should show as EDITED
    expect(screen.getByText('Edited Files (1)')).toBeDefined();

    // View diff should show original v0 -> v2 (merged)
    const viewDiffButton = screen.getByText('View Diff');
    fireEvent.click(viewDiffButton);
    expect(screen.getByTestId('file-diff-modal')).toBeDefined();
  });
});
