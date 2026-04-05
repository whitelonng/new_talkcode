import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { platform } from '@tauri-apps/plugin-os';
import { logger } from '@/lib/logger';

class FileExplorerService {
  async openPath(targetPath: string): Promise<void> {
    try {
      const currentPlatform = await platform();

      if (currentPlatform === 'windows') {
        await revealItemInDir(targetPath);
        return;
      }

      await openPath(targetPath);
    } catch (error) {
      logger.error('Failed to open path in file explorer:', error);
      throw error;
    }
  }
}

export const fileExplorerService = new FileExplorerService();
