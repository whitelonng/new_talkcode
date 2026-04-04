import { stat } from '@tauri-apps/plugin-fs';
import { platform } from '@tauri-apps/plugin-os';
import { Command, open } from '@tauri-apps/plugin-shell';
import { logger } from '@/lib/logger';

class FileExplorerService {
  async openPath(targetPath: string): Promise<void> {
    try {
      const currentPlatform = await platform();

      if (currentPlatform === 'windows') {
        const info = await stat(targetPath);
        const isDirectory = info.isDirectory;

        if (isDirectory) {
          await Command.create('explorer', [targetPath]).execute();
          return;
        }

        await Command.create('explorer', ['/select,', targetPath]).execute();
        return;
      }

      await open(targetPath);
    } catch (error) {
      logger.error('Failed to open path in file explorer:', error);
      throw error;
    }
  }
}

export const fileExplorerService = new FileExplorerService();
