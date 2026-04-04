import { BaseDirectory, exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';

export interface WindowState {
  label: string;
  projectId?: string;
  rootPath?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface WindowsState {
  windows: WindowState[];
  lastActive?: string;
}

const STORE_FILE = 'windows-state.json';

type SanitizedState = {
  state: WindowsState;
  changed: boolean;
};

function sanitizeState(input: WindowsState): SanitizedState {
  let changed = false;
  const windows = Array.isArray(input?.windows) ? input.windows : [];
  if (!Array.isArray(input?.windows)) {
    changed = true;
  }

  const deduped: WindowState[] = [];
  const seenLabels = new Set<string>();
  const seenRoots = new Set<string>();

  for (let i = windows.length - 1; i >= 0; i -= 1) {
    const window = windows[i];
    if (!window || typeof window.label !== 'string' || window.label.trim() === '') {
      changed = true;
      continue;
    }

    const rootPath =
      typeof window.rootPath === 'string' && window.rootPath.trim() !== ''
        ? window.rootPath
        : undefined;

    if (seenLabels.has(window.label)) {
      changed = true;
      continue;
    }

    if (rootPath && seenRoots.has(rootPath)) {
      changed = true;
      continue;
    }

    seenLabels.add(window.label);
    if (rootPath) {
      seenRoots.add(rootPath);
    }

    deduped.push({ ...window, rootPath });
  }

  deduped.reverse();

  if (deduped.length !== windows.length) {
    changed = true;
  }

  return {
    state: {
      windows: deduped,
      lastActive: input?.lastActive,
    },
    changed,
  };
}

export class WindowStateStore {
  private constructor() {}

  private static async readData(): Promise<WindowsState> {
    try {
      const fileExists = await exists(STORE_FILE, { baseDir: BaseDirectory.AppData });
      if (!fileExists) {
        return { windows: [] };
      }
      const content = await readTextFile(STORE_FILE, { baseDir: BaseDirectory.AppData });
      const parsed = JSON.parse(content) as WindowsState;
      const sanitized = sanitizeState(parsed);
      if (sanitized.changed) {
        await WindowStateStore.writeData(sanitized.state);
      }
      return sanitized.state;
    } catch (error) {
      logger.error('Failed to read window state:', error);
      return { windows: [] };
    }
  }

  private static async writeData(data: WindowsState): Promise<void> {
    const sanitized = sanitizeState(data);
    await writeTextFile(STORE_FILE, JSON.stringify(sanitized.state, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  }

  static async saveWindowState(state: WindowState): Promise<void> {
    try {
      const currentState = await WindowStateStore.readData();

      const existingIndex = currentState.windows.findIndex((w) => w.label === state.label);
      let nextState = currentState;

      if (existingIndex >= 0) {
        currentState.windows[existingIndex] = state;
      } else {
        const rootPath =
          typeof state.rootPath === 'string' && state.rootPath.trim() !== ''
            ? state.rootPath
            : undefined;
        const filtered = rootPath
          ? currentState.windows.filter((w) => w.rootPath !== rootPath)
          : currentState.windows;
        if (filtered.length !== currentState.windows.length) {
          nextState = {
            ...currentState,
            windows: filtered,
          };
        }
        nextState.windows.push(state);
      }

      await WindowStateStore.writeData(nextState);
    } catch (error) {
      logger.error('Failed to save window state:', error);
    }
  }

  static async getWindowsState(): Promise<WindowsState> {
    return WindowStateStore.readData();
  }

  static async removeWindowState(label: string): Promise<void> {
    try {
      const currentState = await WindowStateStore.readData();
      currentState.windows = currentState.windows.filter((w) => w.label !== label);
      await WindowStateStore.writeData(currentState);
    } catch (error) {
      logger.error('Failed to remove window state:', error);
    }
  }

  static async setLastActiveWindow(label: string): Promise<void> {
    try {
      const currentState = await WindowStateStore.readData();
      currentState.lastActive = label;
      await WindowStateStore.writeData(currentState);
    } catch (error) {
      logger.error('Failed to set last active window:', error);
    }
  }

  static async clearAll(): Promise<void> {
    try {
      const currentState = await WindowStateStore.readData();
      const clearedCount = currentState.windows.length;
      await WindowStateStore.writeData({ windows: [] });
      logger.info(`Cleared ${clearedCount} window states`);
    } catch (error) {
      logger.error('Failed to clear window states:', error);
    }
  }

  static async getWindowsToRestore(): Promise<WindowState[]> {
    try {
      const state = await WindowStateStore.getWindowsState();
      const windowsToRestore = state.windows.filter((w) => w.label !== 'main' && w.rootPath);
      const uniqueByRoot = new Map<string, WindowState>();

      for (const window of windowsToRestore) {
        if (!window.rootPath) continue;
        uniqueByRoot.set(window.rootPath, window);
      }

      const dedupedWindows = Array.from(uniqueByRoot.values());

      if (dedupedWindows.length !== windowsToRestore.length) {
        await WindowStateStore.clearAll();
        for (const window of dedupedWindows) {
          await WindowStateStore.saveWindowState(window);
        }
        logger.info(
          `Deduplicated window restore list from ${windowsToRestore.length} to ${dedupedWindows.length}`
        );
      }

      logger.info(`Found ${dedupedWindows.length} windows to restore from saved state`);
      return dedupedWindows;
    } catch (error) {
      logger.error('Failed to get windows to restore:', error);
      return [];
    }
  }
}
