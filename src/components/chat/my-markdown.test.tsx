import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MyMarkdown from './my-markdown';

// Mock @tauri-apps/plugin-shell
const mockOpen = vi.fn();
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (url: string) => mockOpen(url),
}));

describe('MyMarkdown - External Links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should open external https links in default browser', () => {
    const content = 'Check out [Google](https://www.google.com) for more info.';

    render(<MyMarkdown content={content} />);

    const link = screen.getByRole('link', { name: 'Google' });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('https://www.google.com');

    fireEvent.click(link);

    expect(mockOpen).toHaveBeenCalledWith('https://www.google.com');
  });

  it('should open external http links in default browser', () => {
    const content = 'Visit [Example](http://example.com) site.';

    render(<MyMarkdown content={content} />);

    const link = screen.getByRole('link', { name: 'Example' });
    fireEvent.click(link);

    expect(mockOpen).toHaveBeenCalledWith('http://example.com');
  });

  it('should not call open for anchor links', () => {
    const content = 'Go to [Section](#section-id) below.';

    render(<MyMarkdown content={content} />);

    const link = screen.getByRole('link', { name: 'Section' });
    fireEvent.click(link);

    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('should not call open for relative links', () => {
    const content = 'Check [this page](/docs/guide) for details.';

    render(<MyMarkdown content={content} />);

    const link = screen.getByRole('link', { name: 'this page' });
    fireEvent.click(link);

    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('should handle multiple links in content', () => {
    const content = `
Visit [Google](https://google.com) or [GitHub](https://github.com) for more.
    `;

    render(<MyMarkdown content={content} />);

    const googleLink = screen.getByRole('link', { name: 'Google' });
    const githubLink = screen.getByRole('link', { name: 'GitHub' });

    fireEvent.click(googleLink);
    expect(mockOpen).toHaveBeenCalledWith('https://google.com');

    mockOpen.mockClear();

    fireEvent.click(githubLink);
    expect(mockOpen).toHaveBeenCalledWith('https://github.com');
  });

  it('should render link with correct styling', () => {
    const content = 'Check [this link](https://example.com).';

    render(<MyMarkdown content={content} />);

    const link = screen.getByRole('link', { name: 'this link' });
    expect(link.className).toContain('text-primary');
    expect(link.className).toContain('hover:underline');
  });

  it('should prevent default navigation for external links', () => {
    const content = 'Visit [Site](https://example.com).';

    render(<MyMarkdown content={content} />);

    const link = screen.getByRole('link', { name: 'Site' });

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

    link.dispatchEvent(clickEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});

describe('MyMarkdown - Rendering', () => {
  it('should render basic markdown content', () => {
    const content = 'Hello **world**!';

    render(<MyMarkdown content={content} />);

    expect(screen.getByText(/Hello/)).toBeDefined();
    expect(screen.getByText(/world/)).toBeDefined();
  });

  it('should render lists correctly', () => {
    const content = `
- Item 1
- Item 2
- Item 3
    `;

    render(<MyMarkdown content={content} />);

    expect(screen.getByText('Item 1')).toBeDefined();
    expect(screen.getByText('Item 2')).toBeDefined();
    expect(screen.getByText('Item 3')).toBeDefined();
  });

  it('should render tables with proper styling', () => {
    const content = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
    `;

    render(<MyMarkdown content={content} />);

    expect(screen.getByText('Header 1')).toBeDefined();
    expect(screen.getByText('Cell 1')).toBeDefined();
  });

  it('should render blockquotes with proper styling', () => {
    const content = '> This is a quote';

    render(<MyMarkdown content={content} />);

    const blockquote = screen.getByText('This is a quote').closest('blockquote');
    expect(blockquote).toBeDefined();
    expect(blockquote?.className).toContain('border-l-4');
  });
});
