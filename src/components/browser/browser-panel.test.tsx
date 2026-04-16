import { act, fireEvent, render, screen } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserPanel } from './browser-panel';

const {
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
  mockClipboardWriteText,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
  mockClipboardWriteText: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
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
      openDevtools: 'Developer mode',
      closeBrowser: 'Close',
      stylePickerActive: 'Style picker active',
      stylePickerIdle: 'Style picker idle',
      localhostPreviewLoading: 'Loading localhost page for style picking...',
      browserPanelTitle: 'Browser panel',
      browserPanelDescription: 'Preview project pages',
      stylePickerActiveHint: 'Click an element in the preview to copy its styles.',
      stylePickerActivate: 'Activate style picker',
      openDevtoolsFailed: 'Failed to open developer mode',
      localhostPreviewLoadFailed: 'Failed to load localhost preview',
    },
  }),
}));

describe('BrowserPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboardWriteText.mockResolvedValue(undefined);

    Object.assign(navigator, {
      clipboard: {
        writeText: mockClipboardWriteText,
      },
    });
  });

  it('keeps file preview srcDoc stable while toggling picker inspector mode', async () => {
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
    expect(initialSrcDoc).toContain('talkcody-picker-runtime');

    await act(async () => {
      fireEvent.load(iframe);
    });

    // Click the picker toggle button (last button)
    const buttons = container.querySelectorAll('button');
    await act(async () => {
      fireEvent.click(buttons[buttons.length - 1] as HTMLButtonElement);
    });

    // Picker should now be active — status text updates
    expect(screen.getByText('Style picker active')).toBeInTheDocument();
    // Hint banner should appear
    expect(
      screen.getByText('Click an element in the preview to copy its styles.')
    ).toBeInTheDocument();
    // srcDoc must remain unchanged (no re-render of iframe content)
    expect(iframe.getAttribute('srcdoc')).toBe(initialSrcDoc);
  });

  it('renders file preview with picker injection for HTML files', () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><h1>Test</h1></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser');
    const srcDoc = iframe.getAttribute('srcdoc') || '';

    // Picker styles and script are injected
    expect(srcDoc).toContain('talkcody-style-picker-highlight');
    expect(srcDoc).toContain('talkcody-picker-runtime');
    // Original content preserved
    expect(srcDoc).toContain('<h1>Test</h1>');
  });

  it('copies element info to clipboard on postMessage from iframe', async () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/page.html"
        currentContent="<html><body><h1>Test</h1></body></html>"
        onOpenUrl={vi.fn()}
      />
    );

    // Simulate a pick message from the iframe
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'talkcody-picker',
            action: 'picked',
            summary: 'selector: h1\ntag: h1\ntext: Test',
            selector: 'h1',
            tag: 'h1',
          },
        })
      );
    });

    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      'selector: h1\ntag: h1\ntext: Test'
    );
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Style information copied to clipboard'
    );
  });

  it('shows empty state for non-HTML files', () => {
    render(
      <BrowserPanel
        sourceType="file"
        currentUrl=""
        currentFilePath="/repo/data.json"
        currentContent='{"key": "value"}'
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser');
    const srcDoc = iframe.getAttribute('srcdoc') || '';

    // Non-HTML files get a text preview wrapper
    expect(srcDoc).toContain('"key"');
  });

  it('renders localhost URL with src attribute for live preview', () => {
    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="http://localhost:3000"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Project browser localhost preview');
    expect(iframe.getAttribute('src')).toBe('http://localhost:3000');
    expect(iframe.getAttribute('srcdoc')).toBeNull();
  });

  it('disables picker for non-localhost external URLs', () => {
    const { container } = render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1] as HTMLButtonElement);

    expect(mockToastInfo).toHaveBeenCalledWith(
      'Style picker currently works for local HTML/SVG previews.'
    );
  });

  it('opens devtools from the browser toolbar', async () => {
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValue(undefined);

    render(
      <BrowserPanel
        sourceType="url"
        currentUrl="https://example.com"
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /developer mode/i });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockInvoke).toHaveBeenCalledWith('open_current_window_devtools');
  });

  it('submits URL from address bar on Enter', () => {
    const onOpenUrl = vi.fn();
    render(
      <BrowserPanel
        sourceType="none"
        currentUrl=""
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={onOpenUrl}
      />
    );

    const input = screen.getByPlaceholderText('Enter URL');
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onOpenUrl).toHaveBeenCalledWith('http://example.com');
  });

  it('does not normalize URLs that already have protocol', () => {
    const onOpenUrl = vi.fn();
    render(
      <BrowserPanel
        sourceType="none"
        currentUrl=""
        currentFilePath={null}
        currentContent={null}
        onOpenUrl={onOpenUrl}
      />
    );

    const input = screen.getByPlaceholderText('Enter URL');
    fireEvent.change(input, { target: { value: 'https://secure.example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onOpenUrl).toHaveBeenCalledWith('https://secure.example.com');
  });
});
