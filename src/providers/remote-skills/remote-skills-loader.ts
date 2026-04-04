import remoteSkillsDefault from '@talkcody/shared/data/remote-skills-config.json';
import type { RemoteSkillsConfiguration } from '@talkcody/shared/types/remote-skills';
import { BaseDirectory, exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';

const REMOTE_SKILLS_CACHE_FILENAME = 'remote-skills-cache.json';

/**
 * RemoteSkillsLoader handles loading and caching of remote skills configurations
 * Priority: Memory → File Cache → Default JSON
 */
class RemoteSkillsLoader {
  private memoryCache: RemoteSkillsConfiguration | null = null;
  private cacheFilePath: string | null = null;

  /**
   * Load remote skills configuration with fallback chain
   */
  async load(): Promise<RemoteSkillsConfiguration> {
    // Return memory cache if available
    if (this.memoryCache) {
      return this.memoryCache;
    }

    // Try to load from file cache
    try {
      const config = await this.loadFromFile();
      this.memoryCache = config;
      return config;
    } catch (error) {
      logger.warn('Failed to load remote skills cache file, using default:', error);
      const defaultConfig = remoteSkillsDefault as RemoteSkillsConfiguration;
      this.memoryCache = defaultConfig;
      return defaultConfig;
    }
  }

  /**
   * Load remote skills configuration from cache file
   */
  private async loadFromFile(): Promise<RemoteSkillsConfiguration> {
    const filePath = await this.getCacheFilePath();

    const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
    if (!fileExists) {
      throw new Error('Cache file does not exist');
    }

    const content = await readTextFile(filePath, { baseDir: BaseDirectory.AppData });
    const config = JSON.parse(content) as RemoteSkillsConfiguration;

    // Validate structure
    if (!this.validateConfig(config)) {
      throw new Error('Invalid remote skills configuration structure');
    }

    return config;
  }

  /**
   * Validate remote skills configuration structure
   */
  private validateConfig(config: RemoteSkillsConfiguration): boolean {
    if (!config.version || !Array.isArray(config.remoteSkills)) {
      return false;
    }

    for (const skill of config.remoteSkills) {
      if (
        !skill.id ||
        !skill.name ||
        !skill.category ||
        !skill.description ||
        !skill.repository ||
        !skill.githubPath
      ) {
        logger.warn(`Invalid remote skill config: ${skill.id || 'unknown'}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Update remote skills configuration (save to file and memory)
   */
  async update(config: RemoteSkillsConfiguration): Promise<void> {
    // Validate before saving
    if (!this.validateConfig(config)) {
      throw new Error('Invalid remote skills configuration structure');
    }

    const filePath = await this.getCacheFilePath();
    const content = JSON.stringify(config, null, 2);

    try {
      await writeTextFile(filePath, content, { baseDir: BaseDirectory.AppData });

      // Clear memory cache to ensure fresh load next time
      this.memoryCache = null;

      logger.info('Remote skills configuration updated successfully');
    } catch (error) {
      logger.error('Failed to write remote skills cache:', error);
      throw error;
    }
  }

  /**
   * Get current version from loaded configuration
   * Falls back to file cache or default config if memory cache is empty
   */
  async getVersion(): Promise<string | null> {
    // Return from memory cache if available
    if (this.memoryCache?.version) {
      return this.memoryCache.version;
    }

    // Try to load from file cache
    try {
      const config = await this.loadFromFile();
      return config.version;
    } catch {
      // Fall back to bundled default version
      return (remoteSkillsDefault as RemoteSkillsConfiguration).version;
    }
  }

  /**
   * Clear memory cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.memoryCache = null;
  }

  /**
   * Get the cache file path
   */
  private async getCacheFilePath(): Promise<string> {
    if (this.cacheFilePath) {
      return this.cacheFilePath;
    }

    // Cache file is stored in app data directory
    this.cacheFilePath = REMOTE_SKILLS_CACHE_FILENAME;
    return this.cacheFilePath;
  }

  /**
   * Get default configuration (useful for testing)
   */
  getDefaultConfig(): RemoteSkillsConfiguration {
    return remoteSkillsDefault as RemoteSkillsConfiguration;
  }
}

// Export singleton instance
export const remoteSkillsLoader = new RemoteSkillsLoader();
export default remoteSkillsLoader;
