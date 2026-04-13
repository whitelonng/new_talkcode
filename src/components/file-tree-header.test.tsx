import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileTreeHeader } from './file-tree-header';

vi.mock('@/hooks/use-locale', () => ({
  useTranslation: () => ({
    Sidebar: {
      files: 'Files',
    },
    Chat: {
      toolbar: {
        searchFiles: 'Search Files',
        searchContent: 'Search Content',
      },
    },
  }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    isAppleTheme: false,
  }),
}));

describe('FileTreeHeader', () => {
  it('renders files label and action buttons on the same header row', () => {
    render(
      <FileTreeHeader onOpenFileSearch={vi.fn()} onOpenContentSearch={vi.fn()} />
    );

    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('Files').closest('div')?.parentElement).toContainElement(
      screen.getAllByRole('button')[0]
    );
  });
});
