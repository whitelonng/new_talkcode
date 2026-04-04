import { render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';
import { FileTabs } from './file-tabs';

// Silence toast side-effects
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// JSDOM does not implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('FileTabs path handling', () => {
  const baseProps = {
    activeFileIndex: 0,
    onTabSelect: vi.fn(),
    onTabClose: vi.fn(),
    onCloseOthers: vi.fn(),
    onCloseAll: vi.fn(),
    onCopyPath: vi.fn(),
    onCopyRelativePath: vi.fn(),
    onAddFileToChat: vi.fn(),
    rootPath: '/home/user/project',
  } as const;

  it('should display file name for Unix paths', () => {
    render(
      <FileTabs
        {...baseProps}
        openFiles={[
          {
            path: '/home/user/project/src/index.ts',
            content: '',
            isLoading: false,
            error: null,
            hasUnsavedChanges: false,
          },
        ]}
      />
    );

    expect(screen.getByText('index.ts')).toBeInTheDocument();
  });

  it('should display file name for Windows-style paths (regression for PR #25)', () => {
    render(
      <FileTabs
        {...baseProps}
        openFiles={[
          {
            path: 'C\\\\Users\\\\dev\\\\project\\\\main.ts',
            content: '',
            isLoading: false,
            error: null,
            hasUnsavedChanges: false,
          },
        ]}
      />
    );

    // Should extract the last segment even with backslashes
    expect(screen.getByText('main.ts')).toBeInTheDocument();
  });

  it('should handle mixed separators consistently', () => {
    render(
      <FileTabs
        {...baseProps}
        openFiles={[
          {
            path: 'C\\\\Users/dev/project/feature/file-with-mix.ts',
            content: '',
            isLoading: false,
            error: null,
            hasUnsavedChanges: false,
          },
        ]}
      />
    );

    expect(screen.getByText('file-with-mix.ts')).toBeInTheDocument();
  });
});
