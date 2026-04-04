import { vi } from 'vitest';

const mockUpdateFileContent = vi.fn();
const mockMarkRecentSave = vi.fn();

vi.mock('@/services/repository-service', () => ({
  repositoryService: {
    writeFile: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@/stores/window-scoped-repository-store', () => ({
  useRepositoryStore: vi.fn((selector) =>
    selector({
      updateFileContent: mockUpdateFileContent,
      markRecentSave: mockMarkRecentSave,
    })
  ),
}));

vi.useFakeTimers();

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { repositoryService } from '@/services/repository-service';
import { useFileEditorState } from './use-file-editor-state';

describe('useFileEditorState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should not save to the wrong file when switching files quickly', async () => {
    const onFileSaved = vi.fn();
    const { rerender, result } = renderHook(
      ({ filePath, fileContent }) =>
        useFileEditorState({
          filePath,
          fileContent,
          onFileSaved,
        }),
      {
        initialProps: {
          filePath: 'fileA.txt',
          fileContent: 'content of file A',
        },
      }
    );

    // 1. Modify file A
    act(() => {
      result.current.handleContentChange('new content for file A');
    });

    // 2. Quickly switch to file B before auto-save triggers
    rerender({ filePath: 'fileB.txt', fileContent: 'content of file B' });

    // 3. Advance timers to trigger auto-save
    await act(async () => {
      vi.advanceTimersByTime(2000); // AUTO_SAVE_DELAY
    });
    
    // Wait for any pending promises (the writeFile call)
    await Promise.resolve();

    // Assert that writeFile was called for fileA with the correct content
    expect(repositoryService.writeFile).toHaveBeenCalledWith('fileA.txt', 'new content for file A');

    // Assert that writeFile was NOT called for fileB with fileA's content
    expect(repositoryService.writeFile).not.toHaveBeenCalledWith(
      'fileB.txt',
      'new content for file A'
    );

    expect(onFileSaved).toHaveBeenCalledWith('fileA.txt');
  });

  it('should sync content to openFiles store after save to prevent file watcher from treating it as external change', async () => {
    const onFileSaved = vi.fn();
    const { result } = renderHook(
      ({ filePath, fileContent }) =>
        useFileEditorState({
          filePath,
          fileContent,
          onFileSaved,
        }),
      {
        initialProps: {
          filePath: 'test.txt',
          fileContent: 'original content',
        },
      }
    );

    // 1. Modify the file content
    act(() => {
      result.current.handleContentChange('modified content');
    });

    // 2. Advance timers to trigger auto-save
    await act(async () => {
      vi.advanceTimersByTime(2000); // AUTO_SAVE_DELAY
    });

    // Wait for any pending promises
    await Promise.resolve();

    // 3. Verify writeFile was called
    expect(repositoryService.writeFile).toHaveBeenCalledWith('test.txt', 'modified content');

    // 4. Verify updateFileContent was called to sync the store
    // This is critical to prevent file watcher from treating the saved file as an external change
    expect(mockUpdateFileContent).toHaveBeenCalledWith('test.txt', 'modified content');
  });

  it('should sync content to store when manually saving via saveFileInternal', async () => {
    const { result } = renderHook(
      ({ filePath, fileContent }) =>
        useFileEditorState({
          filePath,
          fileContent,
        }),
      {
        initialProps: {
          filePath: 'manual-save.txt',
          fileContent: 'initial content',
        },
      }
    );

    // 1. Modify the file content
    act(() => {
      result.current.handleContentChange('manually saved content');
    });

    // 2. Manually trigger save
    await act(async () => {
      await result.current.saveFileInternal('manual-save.txt', 'manually saved content');
    });

    // 3. Verify both writeFile and updateFileContent were called
    expect(repositoryService.writeFile).toHaveBeenCalledWith('manual-save.txt', 'manually saved content');
    expect(mockUpdateFileContent).toHaveBeenCalledWith('manual-save.txt', 'manually saved content');
  });

  it('should mark file as recently saved during auto-save to prevent false external change detection', async () => {
    const onFileSaved = vi.fn();
    const { result } = renderHook(
      ({ filePath, fileContent }) =>
        useFileEditorState({
          filePath,
          fileContent,
          onFileSaved,
        }),
      {
        initialProps: {
          filePath: 'auto-save.txt',
          fileContent: 'original content',
        },
      }
    );

    // 1. Modify the file content to trigger auto-save
    act(() => {
      result.current.handleContentChange('auto-saved content');
    });

    // 2. Advance timers to trigger auto-save
    await act(async () => {
      vi.advanceTimersByTime(2000); // AUTO_SAVE_DELAY
    });

    // Wait for any pending promises
    await Promise.resolve();

    // 3. Verify markRecentSave was called BEFORE writeFile
    // This prevents the file watcher from treating the auto-save as an external change
    expect(mockMarkRecentSave).toHaveBeenCalledWith('auto-save.txt');
    expect(repositoryService.writeFile).toHaveBeenCalledWith('auto-save.txt', 'auto-saved content');
    
    // Verify call order: markRecentSave should be called before writeFile
    const markRecentSaveCallOrder = mockMarkRecentSave.mock.invocationCallOrder[0];
    const writeFileCallOrder = (repositoryService.writeFile as any).mock.invocationCallOrder[0];
    expect(markRecentSaveCallOrder).toBeLessThan(writeFileCallOrder);
  });

  it('should mark file as recently saved during manual save to prevent false external change detection', async () => {
    const { result } = renderHook(
      ({ filePath, fileContent }) =>
        useFileEditorState({
          filePath,
          fileContent,
        }),
      {
        initialProps: {
          filePath: 'manual-save.txt',
          fileContent: 'initial content',
        },
      }
    );

    // Clear previous calls
    mockMarkRecentSave.mockClear();
    vi.mocked(repositoryService.writeFile).mockClear();

    // 1. Manually trigger save
    await act(async () => {
      await result.current.saveFileInternal('manual-save.txt', 'manually saved content');
    });

    // 2. Verify markRecentSave was called BEFORE writeFile
    expect(mockMarkRecentSave).toHaveBeenCalledWith('manual-save.txt');
    expect(repositoryService.writeFile).toHaveBeenCalledWith('manual-save.txt', 'manually saved content');
    
    // Verify call order: markRecentSave should be called before writeFile
    const markRecentSaveCallOrder = mockMarkRecentSave.mock.invocationCallOrder[0];
    const writeFileCallOrder = (repositoryService.writeFile as any).mock.invocationCallOrder[0];
    expect(markRecentSaveCallOrder).toBeLessThan(writeFileCallOrder);
  });
});
