import { vi } from 'vitest';

vi.mock('@/services/repository-service', () => ({
  repositoryService: {
    writeFile: vi.fn(() => Promise.resolve()),
    getFileNameFromPath: (path: string) => path.split('/').pop(),
    getLanguageFromExtension: () => 'plaintext',
  },
}));

vi.mock('@/stores/window-scoped-repository-store', () => ({
  useRepositoryStore: vi.fn((selector) =>
    selector({
      updateFileContent: vi.fn(),
      markRecentSave: vi.fn(),
    })
  ),
}));

vi.useFakeTimers();

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFileEditorState } from '@/hooks/use-file-editor-state';
import { repositoryService } from '@/services/repository-service';

describe('FileEditor', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  it('should not save to the wrong file when the file path changes', async () => {
    const initialFilePath = 'path/to/file1.txt';
    const initialContent = 'Hello, world!';
    const newContent = 'This is the new content.';
    const newFilePath = 'path/to/file2.txt';

    const { result, rerender } = renderHook(
      ({ filePath, fileContent }) => useFileEditorState({ filePath, fileContent }),
      {
        initialProps: {
          filePath: initialFilePath,
          fileContent: initialContent,
        },
      }
    );

    act(() => {
      result.current.handleContentChange(newContent);
    });

    rerender({ filePath: newFilePath, fileContent: 'some other content' });

    await act(async () => {
      vi.advanceTimersByTime(2000); // AUTO_SAVE_DELAY
    });

    await Promise.resolve();

    expect(repositoryService.writeFile).toHaveBeenCalledWith(initialFilePath, newContent);
    expect(repositoryService.writeFile).not.toHaveBeenCalledWith(newFilePath, newContent);
  });
});
