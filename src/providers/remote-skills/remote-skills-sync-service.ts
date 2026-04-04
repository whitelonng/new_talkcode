import type {
  RemoteSkillsConfiguration,
  RemoteSkillVersionResponse,
} from '@talkcody/shared/types/remote-skills';
import { getApiUrl } from '@/lib/config';
import { logger } from '@/lib/logger';
import { simpleFetch } from '@/lib/tauri-fetch';
import { remoteSkillsLoader } from '@/providers/remote-skills/remote-skills-loader';

const VERSION_ENDPOINT = '/api/remote-skills/version';
const CONFIGS_ENDPOINT = '/api/remote-skills/configs';

// Check interval: 1 hour
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * RemoteSkillsSyncService handles version checking and automatic updates
 * of remote skills configurations from the remote API
 */
class RemoteSkillsSyncService {
  private checkInterval: number | null = null;
  private isCheckingUpdate = false;

  /**
   * Initialize the sync service
   * Call this on app startup (non-blocking)
   */
  async initialize(): Promise<void> {
    // Check for updates on startup (async, non-blocking)
    this.checkForUpdates().catch((err) => {
      logger.warn('Initial remote skills update check failed:', err);
    });

    // Start background sync
    this.startBackgroundSync();
  }

  /**
   * Check if remote has newer version and update if needed
   * @returns true if update was performed, false otherwise
   */
  async checkForUpdates(): Promise<boolean> {
    // Prevent concurrent checks
    if (this.isCheckingUpdate) {
      logger.info('Remote skills update check already in progress');
      return false;
    }

    this.isCheckingUpdate = true;

    try {
      const localVersion = await remoteSkillsLoader.getVersion();
      const remoteVersion = await this.fetchRemoteVersion();

      // Compare versions (ISO 8601 string comparison works correctly)
      if (!localVersion || remoteVersion.version > localVersion) {
        logger.info(`Updating remote skills: ${localVersion || 'none'} → ${remoteVersion.version}`);
        await this.downloadAndUpdate();
        return true;
      } else {
        logger.info(`Remote skills are up to date (${localVersion})`);
        return false;
      }
    } catch (error) {
      logger.error('Failed to check for remote skills updates:', error);
      // Don't throw - graceful degradation
      return false;
    } finally {
      this.isCheckingUpdate = false;
    }
  }

  /**
   * Fetch remote version info
   */
  private async fetchRemoteVersion(): Promise<RemoteSkillVersionResponse> {
    const url = getApiUrl(VERSION_ENDPOINT);
    const response = await simpleFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch version: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Download and update remote skills configuration
   */
  private async downloadAndUpdate(): Promise<void> {
    const url = getApiUrl(CONFIGS_ENDPOINT);
    const response = await simpleFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch configs: ${response.status} ${response.statusText}`);
    }

    const config: RemoteSkillsConfiguration = await response.json();

    // Validate and save to file cache
    await remoteSkillsLoader.update(config);
    logger.info(`Remote skills updated successfully to version ${config.version}`);

    // Notify UI components that remote skills have been updated
    window.dispatchEvent(new CustomEvent('remoteSkillsUpdated'));
    logger.info('Remote skills updated and UI notified');
  }

  /**
   * Start background sync (checks every hour)
   */
  startBackgroundSync(): void {
    if (this.checkInterval !== null) {
      logger.warn('Background sync already started');
      return;
    }

    this.checkInterval = window.setInterval(() => {
      this.checkForUpdates().catch((err) => {
        logger.warn('Background remote skills update check failed:', err);
      });
    }, CHECK_INTERVAL_MS);

    logger.info('Started background remote skills sync (1 hour interval)');
  }

  /**
   * Stop background sync
   */
  stopBackgroundSync(): void {
    if (this.checkInterval !== null) {
      window.clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Stopped background remote skills sync');
    }
  }

  /**
   * Manually trigger update check (for UI button)
   */
  async manualRefresh(): Promise<boolean> {
    logger.info('Manual remote skills refresh triggered');
    return await this.checkForUpdates();
  }

  /**
   * Get current sync status
   */
  getStatus(): { isChecking: boolean; hasBackgroundSync: boolean } {
    return {
      isChecking: this.isCheckingUpdate,
      hasBackgroundSync: this.checkInterval !== null,
    };
  }
}

// Export singleton instance
export const remoteSkillsSyncService = new RemoteSkillsSyncService();
export default remoteSkillsSyncService;
