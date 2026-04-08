import { error as logError, info as logInfo } from '@tauri-apps/plugin-log';
import { relaunch } from '@tauri-apps/plugin-process';
import type { Update } from '@tauri-apps/plugin-updater';

const UPDATER_DISABLED_MESSAGE = '应用更新功能已暂时关闭';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
}

export interface DownloadProgress {
  downloaded: number;
  total?: number;
  percentage?: number;
}

export type UpdateProgressCallback = (progress: DownloadProgress) => void;

export class UpdateService {
  private static instance: UpdateService;
  private checkingForUpdate = false;
  private downloadingUpdate = false;

  private constructor() {}

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /**
   * Check if an update is available
   */
  async checkForUpdate(): Promise<Update | null> {
    logInfo('Updater disabled: skipping update check');
    return null;
  }

  /**
   * Download and install update with progress tracking
   */
  async downloadAndInstall(_update: Update, _onProgress?: UpdateProgressCallback): Promise<void> {
    throw new Error(UPDATER_DISABLED_MESSAGE);
  }

  /**
   * Check, download, and install update automatically
   */
  async checkAndUpdate(onProgress?: UpdateProgressCallback): Promise<boolean> {
    try {
      const update = await this.checkForUpdate();

      if (!update) {
        return false;
      }

      await this.downloadAndInstall(update, onProgress);
      return true;
    } catch (error) {
      logError(`Auto-update failed: ${error}`);
      throw error;
    }
  }

  /**
   * Restart the application
   */
  async restartApp(): Promise<void> {
    try {
      logInfo('Restarting application...');
      await relaunch();
    } catch (error) {
      logError(`Failed to restart application: ${error}`);
      throw new Error(`Failed to restart application: ${error}`);
    }
  }

  /**
   * Extract update information from Update object
   */
  getUpdateInfo(update: Update): UpdateInfo {
    return {
      version: update.version,
      currentVersion: update.currentVersion,
      date: update.date,
      body: update.body,
    };
  }

  /**
   * Check if currently checking for updates
   */
  isCheckingForUpdate(): boolean {
    return this.checkingForUpdate;
  }

  /**
   * Check if currently downloading update
   */
  isDownloadingUpdate(): boolean {
    return this.downloadingUpdate;
  }
}

export const updateService = UpdateService.getInstance();
