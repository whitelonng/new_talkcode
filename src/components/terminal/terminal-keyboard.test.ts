import { describe, expect, it, vi } from 'vitest';
import { copyTerminalSelection, isTerminalCopyShortcut } from './terminal-keyboard';

describe('terminal keyboard helpers', () => {
  it('detects ctrl+c as copy shortcut', () => {
    const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });

    expect(isTerminalCopyShortcut(event)).toBe(true);
  });

  it('detects cmd+c as copy shortcut', () => {
    const event = new KeyboardEvent('keydown', { key: 'C', metaKey: true });

    expect(isTerminalCopyShortcut(event)).toBe(true);
  });

  it('ignores ctrl+shift+c so terminal shortcuts remain unchanged', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(isTerminalCopyShortcut(event)).toBe(true);
  });

  it('does not copy blank selections', async () => {
    const clipboard = {
      writeText: vi.fn(),
    };

    await expect(copyTerminalSelection('   ', clipboard)).resolves.toBe(false);
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('copies non-empty selections to clipboard', async () => {
    const clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    await expect(copyTerminalSelection('npm run test', clipboard)).resolves.toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledWith('npm run test');
  });
});
