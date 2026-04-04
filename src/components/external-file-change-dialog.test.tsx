import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalFileChangeDialog } from './external-file-change-dialog';

// Mock the repository store
const mockApplyExternalChange = vi.fn();
const mockPendingExternalChange = {
  filePath: '/test/path/file.ts',
  diskContent: 'new content from disk',
};

vi.mock('@/stores/window-scoped-repository-store', () => ({
  useRepositoryStore: (selector: (state: unknown) => unknown) => {
    const mockState = {
      pendingExternalChange: mockPendingExternalChange,
      applyExternalChange: mockApplyExternalChange,
    };
    return selector(mockState);
  },
}));

vi.mock('@/hooks/use-locale', () => ({
  useLocale: () => ({
    t: {
      ExternalFileChange: {
        title: 'File Modified Externally',
        description: (fileName: string) => `The file "${fileName}" has been modified externally.`,
        keepLocal: 'Keep My Changes',
        loadDisk: 'Load Disk Version',
      },
    },
  }),
}));

vi.mock('@/services/repository-service', () => ({
  repositoryService: {
    getFileNameFromPath: (path: string) => path.split('/').pop(),
  },
}));

describe('ExternalFileChangeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog when pendingExternalChange exists', () => {
    render(<ExternalFileChangeDialog />);

    expect(screen.getByText('File Modified Externally')).toBeInTheDocument();
    expect(screen.getByText(/file.ts/)).toBeInTheDocument();
    expect(screen.getByText('Keep My Changes')).toBeInTheDocument();
    expect(screen.getByText('Load Disk Version')).toBeInTheDocument();
  });

  it('should call applyExternalChange(true) when clicking Keep My Changes', () => {
    render(<ExternalFileChangeDialog />);

    const keepButton = screen.getByText('Keep My Changes');
    fireEvent.click(keepButton);

    expect(mockApplyExternalChange).toHaveBeenCalledWith(true);
  });

  it('should call applyExternalChange(false) when clicking Load Disk Version', () => {
    render(<ExternalFileChangeDialog />);

    const loadButton = screen.getByText('Load Disk Version');
    fireEvent.click(loadButton);

    expect(mockApplyExternalChange).toHaveBeenCalledWith(false);
  });
});
