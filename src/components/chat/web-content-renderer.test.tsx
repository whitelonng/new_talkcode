import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WebContentRenderer } from './web-content-renderer';

vi.mock('@/hooks/use-locale', () => ({
  useLocale: () => ({
    t: {
      Chat: {
        outputFormat: {
          viewSource: 'View Source',
          viewRendered: 'View Rendered',
        },
      },
    },
  }),
}));

describe('WebContentRenderer', () => {
  it('injects Tailwind and wraps HTML into a full document', () => {
    const content = '<div class="p-4"><h1 class="text-2xl font-bold">Hello</h1></div>';

    render(<WebContentRenderer content={content} />);

    const iframe = screen.getByTitle('Web content preview');
    const srcDoc = iframe.getAttribute('srcdoc') || '';

    expect(srcDoc.toLowerCase()).toContain('<!doctype html>');
    expect(srcDoc).toContain('https://cdn.tailwindcss.com');
    expect(srcDoc).toContain(content);
  });

  it('toggles to source view and shows raw HTML', () => {
    const content = '<section class="p-6">Source test</section>';

    render(<WebContentRenderer content={content} />);

    fireEvent.click(screen.getByRole('button', { name: 'View Source' }));

    const pre = screen.getByText(content);
    expect(pre).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Rendered' })).toBeInTheDocument();
  });

  it('renders source view when HTML is unsafe', () => {
    const content = '<div>Unsafe</div><script>alert(1)</script>';

    render(<WebContentRenderer content={content} />);

    expect(screen.queryByTitle('Web content preview')).not.toBeInTheDocument();
    expect(screen.getByText(content)).toBeInTheDocument();
  });
});
