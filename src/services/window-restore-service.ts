import { getCurrentWindow } from '@tauri-apps/api/window';
import { logger } from '@/lib/logger';
import { type WindowState, WindowStateStore } from '@/lib/window-state-store';

export class WindowRestoreService {
  private constructor() {}

  static async saveCurrentWindowState(projectId?: string, rootPath?: string): Promise<void> {
    try {
      const currentWindow = getCurrentWindow();
      const label = currentWindow.label;

      const position = await currentWindow.outerPosition();
      const size = await currentWindow.outerSize();

      const state: WindowState = {
        label,
        projectId,
        rootPath,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      };

      await WindowStateStore.saveWindowState(state);
      logger.info('Window state saved:', state);
    } catch (error) {
      logger.error('Failed to save window state:', error);
    }
  }

  static async onWindowClosed(label: string): Promise<void> {
    try {
      await WindowStateStore.removeWindowState(label);
      logger.info(`Window state removed for: ${label}`);
    } catch (error) {
      logger.error(`Failed to remove window state for ${label}:`, error);
    }
  }
}
