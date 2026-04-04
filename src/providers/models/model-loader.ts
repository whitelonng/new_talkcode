// src/providers/models/model-loader.ts

import modelsDefault from '@talkcody/shared/data/models-config.json';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';
import { customModelService } from '@/providers/custom/custom-model-service';
import type { ModelsConfiguration } from '@/types/models';

/**
 * ModelLoader handles loading and caching of model configurations
 * Priority: Memory → File Cache → Default JSON
 */
class ModelLoader {
  private memoryCache: ModelsConfiguration | null = null;

  /**
   * Load models configuration with fallback chain
   * Merges server config with user's custom models
   */
  async load(): Promise<ModelsConfiguration> {
    // Return memory cache if available
    if (this.memoryCache) {
      return this.memoryCache;
    }

    // Load server config from Rust
    let serverConfig: ModelsConfiguration;
    try {
      serverConfig = await this.loadFromRust();
    } catch (error) {
      logger.warn('Failed to load models from Rust, using default:', error);
      serverConfig = modelsDefault as ModelsConfiguration;
    }

    // Load custom models
    let customConfig: ModelsConfiguration;
    try {
      customConfig = await customModelService.getCustomModels();
    } catch (error) {
      logger.warn('Failed to load custom models:', error);
      customConfig = { version: 'custom', models: {} };
    }

    // Merge configs (custom models take precedence)
    const mergedConfig: ModelsConfiguration = {
      version: serverConfig.version,
      models: {
        ...serverConfig.models,
        ...customConfig.models,
      },
    };

    this.memoryCache = mergedConfig;
    return mergedConfig;
  }

  /**
   * Load models configuration from Rust backend
   */
  private async loadFromRust(): Promise<ModelsConfiguration> {
    const config = await invoke<ModelsConfiguration>('llm_get_models_config');

    // Validate structure
    if (!this.validateConfig(config)) {
      throw new Error('Invalid models configuration structure');
    }

    return config;
  }

  /**
   * Validate models configuration structure
   */
  private validateConfig(config: ModelsConfiguration): boolean {
    if (!config.version || !config.models) {
      return false;
    }

    for (const [key, model] of Object.entries(config.models)) {
      if (!model.name || !Array.isArray(model.providers)) {
        logger.warn(`Invalid model config for key: ${key}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Update models configuration (no-op on Rust source)
   */
  async update(config: ModelsConfiguration): Promise<void> {
    if (!this.validateConfig(config)) {
      throw new Error('Invalid models configuration structure');
    }

    this.memoryCache = null;
    logger.info('Model configuration update requested; cache cleared');
  }

  /**
   * Get current version from loaded configuration
   * Falls back to default config if Rust load fails
   */
  async getVersion(): Promise<string | null> {
    if (this.memoryCache?.version) {
      return this.memoryCache.version;
    }

    try {
      const config = await this.loadFromRust();
      return config.version;
    } catch {
      return (modelsDefault as ModelsConfiguration).version;
    }
  }

  /**
   * Clear memory cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.memoryCache = null;
  }

  /**
   * Get default configuration (useful for testing)
   */
  getDefaultConfig(): ModelsConfiguration {
    return modelsDefault as ModelsConfiguration;
  }
}

// Export singleton instance
export const modelLoader = new ModelLoader();
export default modelLoader;
