import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserPanel } from './browser-panel';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/hooks/use-locale', () => ({
  useTranslation: () => ({
    RepositoryLayout: {
      stylePickerCopied: 'Style information copied to clipboard',
      stylePickerCopyFailed: 'Failed to copy style information',
      stylePickerUrlLimited: 'Style picker currently works for local HTML/SVG previews.',
      browserEmptyState: 'Empty browser state',
      browserAddressPlaceholder: 'Enter URL',
      openBrowser: 'Open',
      refreshBrowser: 'Refresh',
      closeBrowser: 'Close',
      stylePickerActive: 'Style picker active',
      stylePickerIdle: 'Style picker idle',
      localhostPreviewLoading: 'Loading localhost page for style picking...',
      browserPanelTitle: 'Browser panel',
      browserPanelDescription: 'Preview project pages',
      stylePickerActiveHint: 'Click an element in the preview to copy its styles.',
      stylePickerActivate: 'Activate style picker',
      localhostPreviewLoadFailed: 'Failed to load localhost preview',
    },
  }),
}));

describe('BrowserPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps file preview srcDoc stable while toggling picker inspector mode', () => {
    const { container } = render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/index.html"
        currentContent="<html><body><main class='hero'>Hello</main></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser');
    const initialSrcDoc = iframe.getAttribute('srcdoc');

    expect(initialSrcDoc).toContain('talkcody-style-picker-highlight');
    expect(initialSrcDoc).toContain('data-talkcody-picker="inactive"');

    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1] as HTMLButtonElement);

    expect(screen.getByText('Status: active')).toBeInTheDocument();
    expect(screen.getByText(/Inspector mode enabled/i)).toBeInTheDocument();
    expect(iframe.getAttribute('srcdoc')).toBe(initialSrcDoc);
  });
});
