import { beforeEach, describe, expect, it, vi } from 'vitest';

let fileContent: string | null = null;

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 'AppData' },
  exists: vi.fn().mockImplementation(async () => fileContent !== null),
  readTextFile: vi.fn().mockImplementation(async () => fileContent ?? ''),
  writeTextFile: vi.fn().mockImplementation(async (_path: string, content: string) => {
    fileContent = content;
  }),
}));

import { WindowStateStore } from '@/lib/window-state-store';

const setStateFile = (state: unknown) => {
  fileContent = JSON.stringify(state, null, 2);
};

const getStateFile = () => {
  if (!fileContent) {
    return null;
  }
  return JSON.parse(fileContent) as { windows: Array<Record<string, unknown>> };
};

beforeEach(() => {
  fileContent = null;
});

describe('WindowStateStore', () => {
  it('dedupes by rootPath when saving a new window state', async () => {
    setStateFile({
      windows: [{ label: 'window-a', rootPath: '/project-a' }],
    });

    await WindowStateStore.saveWindowState({
      label: 'window-b',
      rootPath: '/project-a',
    });

    const parsed = getStateFile();
    expect(parsed?.windows.length).toBe(1);
    expect(parsed?.windows[0]?.label).toBe('window-b');
  });

  it('sanitizes duplicate labels and root paths on read', async () => {
    setStateFile({
      windows: [
        { label: 'window-a', rootPath: '/project-a' },
        { label: 'window-a', rootPath: '/project-a' },
        { label: '', rootPath: '/project-b' },
        { label: 'window-b', rootPath: '/project-a' },
      ],
    });

    const state = await WindowStateStore.getWindowsState();
    expect(state.windows.length).toBe(1);
    expect(state.windows[0]?.label).toBe('window-b');

    const parsed = getStateFile();
    expect(parsed?.windows.length).toBe(1);
    expect(parsed?.windows[0]?.label).toBe('window-b');
  });

  it('dedupes restored windows by rootPath and persists the cleaned state', async () => {
    setStateFile({
      windows: [
        { label: 'window-a', rootPath: '/project-a' },
        { label: 'window-b', rootPath: '/project-a' },
        { label: 'main', rootPath: '/project-b' },
      ],
    });

    const windowsToRestore = await WindowStateStore.getWindowsToRestore();
    expect(windowsToRestore.length).toBe(1);
    expect(windowsToRestore[0]?.label).toBe('window-b');

    const parsed = getStateFile();
    expect(parsed?.windows.length).toBe(2);
    expect(parsed?.windows[0]?.label).toBe('window-b');
  });
});
