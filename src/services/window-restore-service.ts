import { getCurrentWindow } from '@tauri-apps/api/window';
import { logger } from '@/lib/logger';
import { type WindowState, WindowStateStore } from '@/lib/window-state-store';
import { WindowManagerService } from './window-manager-service';

export class WindowRestoreService {
  private constructor() {}

  /**
   * Save current window state
   */
  static async saveCurrentWindowState(projectId?: string, rootPath?: string): Promise<void> {
    try {
      const currentWindow = getCurrentWindow();
      const label = currentWindow.label;

      // Get window position and size
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

  /**
   * Restore all windows from last session
   * This should be called on app startup
   */
  static async restoreWindows(): Promise<void> {
    try {
      const windowsToRestore = await WindowStateStore.getWindowsToRestore();

      if (windowsToRestore.length === 0) {
        logger.info('No windows to restore');
        return;
      }

      logger.info(`Restoring ${windowsToRestore.length} windows`);

      // Restore windows one by one without focusing existing windows
      for (const windowState of windowsToRestore) {
        try {
          if (windowState.rootPath) {
            await WindowManagerService.openProjectInWindow(
              windowState.rootPath,
              windowState.projectId,
              false,
              true
            );
            logger.info(`Restored window for: ${windowState.rootPath}`);
          }
        } catch (error) {
          logger.error(`Failed to restore window for ${windowState.rootPath}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to restore windows:', error);
    }
  }

  /**
   * Save all open windows state before closing
   * Uses replacement strategy: clears all existing states then saves only currently open windows
   * This ensures the saved state matches exactly what windows are actually open
   */
  static async saveAllWindowsState(): Promise<void> {
    try {
      const windows = await WindowManagerService.getAllWindows();

      // Filter to get only project windows (exclude main window)
      const projectWindows = windows.filter(
        (window) => window.label !== 'main' && window.root_path
      );

      logger.info(`Saving ${projectWindows.length} window states (clearing old states first)`);

      // IMPORTANT: Clear all existing window states first
      // This prevents accumulation of closed window states
      await WindowStateStore.clearAll();

      // Save only currently open windows
      for (const window of projectWindows) {
        const state: WindowState = {
          label: window.label,
          projectId: window.project_id,
          rootPath: window.root_path,
        };
        await WindowStateStore.saveWindowState(state);
        logger.info(`Saved window state: ${window.root_path}`);
      }

      logger.info(`All window states saved: ${projectWindows.length} windows`);
    } catch (error) {
      logger.error('Failed to save all window states:', error);
    }
  }

  /**
   * Clean up window state when a window is closed
   */
  static async onWindowClosed(label: string): Promise<void> {
    try {
      await WindowStateStore.removeWindowState(label);
      logger.info(`Window state removed for: ${label}`);
    } catch (error) {
      logger.error(`Failed to remove window state for ${label}:`, error);
    }
  }
}
