import { logger } from '@/lib/logger';
import { modelLoader } from '@/providers/models/model-loader';
import type { ProviderConfig } from '@/types/api-keys';
import type { ModelConfig as ModelConfigType } from '@/types/models';
import {
  CLAUDE_HAIKU,
  CODE_STARL,
  GEMINI_25_FLASH_LITE,
  GPT5_MINI,
  GROK_CODE_FAST,
  MINIMAX_M21,
  NANO_BANANA_PRO,
  SCRIBE_V2_REALTIME,
} from './model-constants';
import { PROVIDER_CONFIGS } from './provider-config';

export {
  CLAUDE_HAIKU,
  CODE_STARL,
  GEMINI_25_FLASH_LITE,
  GPT5_MINI,
  GROK_CODE_FAST,
  MINIMAX_M21,
  NANO_BANANA_PRO,
  SCRIBE_V2_REALTIME,
};

// Dynamic model configs loaded from JSON
let MODEL_CONFIGS: Record<string, ModelConfigType> = {};

// Promise to track initialization status
let initPromise: Promise<void> | null = null;

// Initialize models from loader
async function initializeModels(): Promise<void> {
  try {
    const config = await modelLoader.load();
    MODEL_CONFIGS = config.models;
  } catch (error) {
    logger.error('Failed to load models:', error);
    // Fallback to empty object - will use default configs
    MODEL_CONFIGS = {};
  }
}

/**
 * Ensure models are initialized before use
 * Call this before accessing MODEL_CONFIGS to avoid race conditions
 */
export function ensureModelsInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeModels();
  }
  return initPromise;
}

// Initialize on module load - but defer to avoid circular dependency issues
if (typeof window !== 'undefined') {
  // Browser environment - initialize after a tick to allow modules to load
  setTimeout(() => {
    initPromise = initializeModels();
  }, 0);
} else {
  // Node/test environment - initialize synchronously
  initPromise = initializeModels();
}

export async function refreshModelConfigs(): Promise<void> {
  try {
    // Clear memory cache to force reload from file/remote
    modelLoader.clearCache();
    const config = await modelLoader.load();
    // Update the MODEL_CONFIGS object in-place to maintain references
    for (const key of Object.keys(MODEL_CONFIGS)) {
      delete MODEL_CONFIGS[key];
    }
    Object.assign(MODEL_CONFIGS, config.models);
    logger.info('Model configs refreshed successfully');
  } catch (error) {
    logger.error('Failed to refresh model configs:', error);
  }
}

// Export MODEL_CONFIGS for backward compatibility
export { MODEL_CONFIGS };

export type ModelKey = string;

// Import provider types from provider configs
export type { ProviderIds as ProviderType } from '@/providers/config/provider-config';

// Re-export ModelConfig from types
export type { ModelConfig } from '@/types/models';

export function getProvidersForModel(model: string): ProviderConfig[] {
  const modelKey = model.split('@')[0] || model;
  const config = MODEL_CONFIGS[modelKey as ModelKey];
  if (!config || !config.providers) return [];

  return config.providers
    .map((id) => {
      const providerId = String(id) as keyof typeof PROVIDER_CONFIGS;
      return PROVIDER_CONFIGS[providerId];
    })
    .filter((p) => p !== undefined) as ProviderConfig[];
}

export function getContextLength(model: string): number {
  // Parse model identifier to extract modelKey (remove @providerId suffix)
  const modelKey = model.split('@')[0] || model;
  const config = MODEL_CONFIGS[modelKey as ModelKey];
  return config?.context_length ?? 200000; // Default fallback
}
