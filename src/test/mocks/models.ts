// src/test/mocks/models.ts
// Centralized mock for ../lib/models

import { vi } from 'vitest';

// Model constants
export const MODEL_CONSTANTS = {
  GEMINI_25_FLASH_LITE: 'gemini-2.5-flash-lite',
  CLAUDE_HAIKU: 'claude-haiku-4.5',
  GPT5: 'gpt-5',
  GPT5_MINI: 'gpt-5-mini',
  MINIMAX_M21: 'minimax-m21',
  CODE_STARL: 'codestral',
  GROK_CODE_FAST: 'grok-code-fast-1',
  GLM_46: 'glm-4.6',
  NANO_BANANA_PRO: 'gemini-3-pro-image',
  SCRIBE_V2_REALTIME: 'scribe-v2-realtime',
  GPT5_NANO: 'gpt-5-nano',
};

export const createMockModels = (
  overrides: {
    initializeModels?: unknown;
    getModelByProviderAndId?: unknown;
    getProviderConfig?: unknown;
    MODEL_CONFIGS?: Record<string, unknown>;
    refreshModelConfigs?: unknown;
    supportsImageOutput?: boolean;
    supportsImageInput?: boolean;
    supportsAudioInput?: boolean;
    getProvidersForModel?: unknown[];
  } = {}
) => ({
  initializeModels: vi.fn().mockResolvedValue(overrides.initializeModels ?? undefined),
  getModelByProviderAndId: vi.fn().mockReturnValue(overrides.getModelByProviderAndId ?? null),
  getProviderConfig: vi.fn().mockReturnValue(overrides.getProviderConfig ?? null),
  ...MODEL_CONSTANTS,
  MODEL_CONFIGS: overrides.MODEL_CONFIGS ?? {},
  refreshModelConfigs: vi.fn().mockResolvedValue(overrides.refreshModelConfigs ?? undefined),
  supportsImageOutput: vi.fn().mockReturnValue(overrides.supportsImageOutput ?? false),
  supportsImageInput: vi.fn().mockReturnValue(overrides.supportsImageInput ?? false),
  supportsAudioInput: vi.fn().mockReturnValue(overrides.supportsAudioInput ?? false),
  getProvidersForModel: vi.fn().mockReturnValue(overrides.getProvidersForModel ?? []),
});

export const mockModels = createMockModels();

/**
 * Mock module for vi.mock('../lib/models', ...)
 */
export default mockModels;
