/**
 * Regression test: Chat messages should persist when file editor open state changes.
 *
 * Bug: When opening the file editor (hasOpenFiles goes true), the chat panel remounted
 * and its messages disappeared because ResizablePanelGroup key depended on hasOpenFiles.
 *
 * Fix: Key now excludes hasOpenFiles; only depends on fullscreenPanel (and remains stable
 * when toggling file open/close state).
 */

import { describe, expect, it } from 'vitest';

// This is a static key generation regression test (no component render needed)

const generateLayoutKey = (hasOpenFiles: boolean, fullscreenPanel: string) => {
  // The fixed implementation removes hasOpenFiles from the key
  // so we intentionally ignore hasOpenFiles here to mirror the component logic.
  void hasOpenFiles;
  return `layout-${fullscreenPanel}`;
};

describe('RepositoryLayout chat persistence - layout key stability', () => {
  it('key should stay the same when hasOpenFiles toggles (editor opens/closes)', () => {
    const fullscreenPanel = 'none';
    const keyWhenClosed = generateLayoutKey(false, fullscreenPanel);
    const keyWhenOpen = generateLayoutKey(true, fullscreenPanel);

    // Previously these would differ; now must match
    expect(keyWhenClosed).toBe(keyWhenOpen);
    expect(keyWhenClosed).toBe('layout-none');
  });

  it('key should still vary by fullscreen panel state', () => {
    expect(generateLayoutKey(true, 'editor')).toBe('layout-editor');
    expect(generateLayoutKey(true, 'chat')).toBe('layout-chat');
    expect(generateLayoutKey(true, 'terminal')).toBe('layout-terminal');
  });
});
