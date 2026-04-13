import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';

export interface WindowInfo {
  label: string;
  project_id?: string;
  root_path?: string;
  title: string;
}

export class WindowManagerService {
  private constructor() {}

  static async getCurrentWindowLabel(): Promise<string> {
    try {
      const label = await invoke<string>('get_current_window_label');
      return label;
    } catch (error) {
      logger.error('Failed to get current window label:', error);
      return 'main';
    }
  }

  static async updateWindowProject(
    label: string,
    projectId?: string,
    rootPath?: string
  ): Promise<void> {
    try {
      await invoke('update_window_project', {
        label,
        projectId,
        rootPath,
      });
    } catch (error) {
      logger.error('Failed to update window project:', error);
      throw error;
    }
  }

  static async startWindowFileWatching(windowLabel: string, path: string): Promise<void> {
    try {
      await invoke('start_window_file_watching', {
        windowLabel,
        path,
      });
    } catch (error) {
      logger.error('Failed to start window file watching:', error);
      throw error;
    }
  }

  static async stopWindowFileWatching(windowLabel: string): Promise<void> {
    try {
      await invoke('stop_window_file_watching', {
        windowLabel,
      });
    } catch (error) {
      logger.error('Failed to stop window file watching:', error);
      throw error;
    }
  }
}
