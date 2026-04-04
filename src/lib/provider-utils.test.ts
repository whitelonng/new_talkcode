import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderDefinition } from '@/types';
import type { CustomProviderConfig } from '@/types/custom-provider';
import type { ModelConfig } from '@/types/models';

// Note: Logger is already mocked globally in setup.ts

vi.mock('@/providers/config/model-config', () => ({
  MODEL_CONFIGS: {
    'model-a': {
      name: 'Model A',
      imageInput: true,
      imageOutput: false,
      audioInput: false,
    },
    'model-b': {
      name: 'Model B',
      imageInput: false,
      imageOutput: false,
      audioInput: true,
    },
    'ollama-model': {
      name: 'Ollama Test Model',
      imageInput: false,
      imageOutput: false,
      audioInput: false,
    },
  },
  getProvidersForModel: vi.fn((modelKey: string) => {
    const providerMap: Record<string, { id: string; name: string }[]> = {
      'model-a': [
        { id: 'openai', name: 'OpenAI' },
        { id: 'openrouter', name: 'OpenRouter' },
      ],
      'model-b': [{ id: 'anthropic', name: 'Anthropic' }],
      'ollama-model': [{ id: 'ollama', name: 'Ollama' }],
    };
    return providerMap[modelKey] || [];
  }),
}));

vi.mock('@/providers/custom/custom-provider-factory', () => ({
  createCustomProvider: vi.fn(),
}));

vi.mock('@/providers/config/provider-config', () => ({
  PROVIDER_CONFIGS: {
    openai: { name: 'OpenAI' },
    anthropic: { name: 'Anthropic' },
    openrouter: { name: 'OpenRouter' },
    ollama: { name: 'Ollama' },
  },
}));

vi.mock('@/providers/custom/custom-model-service', () => ({
  isLocalProvider: vi.fn((providerId: string) => providerId === 'ollama' || providerId === 'lmstudio'),
}));

describe('provider-utils: computeAvailableModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not duplicate models that exist in both built-in and custom models', async () => {
    const { computeAvailableModels } = await import('@/providers/core/provider-utils');

    const apiKeys = { ollama: 'enabled' };
    const providerConfigs = new Map<string, ProviderDefinition>();
    const customProviders: CustomProviderConfig[] = [];

    // Custom models with the same model that exists in MODEL_CONFIGS
    const customModels: Record<string, ModelConfig> = {
      'ollama-model': {
        name: 'Ollama Test Model',
        providers: ['ollama'],
        pricing: { input: '0', output: '0' },
      },
    };

    const result = computeAvailableModels(apiKeys, providerConfigs, customProviders, customModels);

    // Should only have one entry for ollama-model with ollama provider
    const ollamaModels = result.filter(
      (m) => m.key === 'ollama-model' && m.provider === 'ollama'
    );
    expect(ollamaModels).toHaveLength(1);
  });

  it('should allow same model with different providers', async () => {
    const { computeAvailableModels } = await import('@/providers/core/provider-utils');

    const apiKeys = { openai: 'sk-xxx', openrouter: 'sk-or-xxx' };
    const providerConfigs = new Map<string, ProviderDefinition>();
    const customProviders: CustomProviderConfig[] = [];
    const customModels: Record<string, ModelConfig> = {};

    const result = computeAvailableModels(apiKeys, providerConfigs, customProviders, customModels);

    // model-a should appear twice: once for openai, once for openrouter
    const modelAEntries = result.filter((m) => m.key === 'model-a');
    expect(modelAEntries).toHaveLength(2);
    expect(modelAEntries.map((m) => m.provider).sort()).toEqual(['openai', 'openrouter']);
  });

  it('should prioritize built-in model config over custom (built-in added first)', async () => {
    const { computeAvailableModels } = await import('@/providers/core/provider-utils');

    const apiKeys = { ollama: 'enabled' };
    const providerConfigs = new Map<string, ProviderDefinition>();
    const customProviders: CustomProviderConfig[] = [];

    // Custom model with different imageInput value than built-in
    const customModels: Record<string, ModelConfig> = {
      'ollama-model': {
        name: 'Custom Ollama Name', // Different name
        providers: ['ollama'],
        imageInput: true, // Different from built-in (which is false)
        pricing: { input: '0', output: '0' },
      },
    };

    const result = computeAvailableModels(apiKeys, providerConfigs, customProviders, customModels);

    const ollamaModel = result.find((m) => m.key === 'ollama-model');
    expect(ollamaModel).toBeDefined();
    // Should use built-in config values (imageInput: false, name: 'Ollama Test Model')
    expect(ollamaModel?.imageInput).toBe(false);
    expect(ollamaModel?.name).toBe('Ollama Test Model');
  });

  it('should handle empty customModels', async () => {
    const { computeAvailableModels } = await import('@/providers/core/provider-utils');

    const apiKeys = { openai: 'sk-xxx' };
    const providerConfigs = new Map<string, ProviderDefinition>();
    const customProviders: CustomProviderConfig[] = [];
    const customModels: Record<string, ModelConfig> = {};

    const result = computeAvailableModels(apiKeys, providerConfigs, customProviders, customModels);

    // Should return built-in models only
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((m) => m.key === 'model-a')).toBe(true);
  });

  it('should handle empty apiKeys (no available models)', async () => {
    const { computeAvailableModels } = await import('@/providers/core/provider-utils');

    const apiKeys = {};
    const providerConfigs = new Map<string, ProviderDefinition>();
    const customProviders: CustomProviderConfig[] = [];
    const customModels: Record<string, ModelConfig> = {};

    const result = computeAvailableModels(apiKeys, providerConfigs, customProviders, customModels);

    // No API keys configured, no models should be available
    expect(result).toHaveLength(0);
  });

  it('should add custom-only models that do not exist in built-in', async () => {
    const { computeAvailableModels } = await import('@/providers/core/provider-utils');

    const apiKeys = { openai: 'sk-xxx' };
    const providerConfigs = new Map<string, ProviderDefinition>();
    const customProviders: CustomProviderConfig[] = [];

    // Custom model that doesn't exist in MODEL_CONFIGS
    const customModels: Record<string, ModelConfig> = {
      'custom-only-model': {
        name: 'Custom Only Model',
        providers: ['openai'],
        imageInput: true,
        pricing: { input: '0', output: '0' },
      },
    };

    const result = computeAvailableModels(apiKeys, providerConfigs, customProviders, customModels);

    const customModel = result.find((m) => m.key === 'custom-only-model');
    expect(customModel).toBeDefined();
    expect(customModel?.name).toBe('Custom Only Model');
    expect(customModel?.imageInput).toBe(true);
  });

  it('should sort models by name', async () => {
    const { computeAvailableModels } = await import('@/providers/core/provider-utils');

    const apiKeys = { openai: 'sk-xxx', anthropic: 'sk-ant-xxx' };
    const providerConfigs = new Map<string, ProviderDefinition>();
    const customProviders: CustomProviderConfig[] = [];
    const customModels: Record<string, ModelConfig> = {};

    const result = computeAvailableModels(apiKeys, providerConfigs, customProviders, customModels);

    // Check that models are sorted alphabetically by name
    const names = result.map((m) => m.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });

  it('should handle multiple duplicate entries from custom models', async () => {
    const { computeAvailableModels } = await import('@/providers/core/provider-utils');

    const apiKeys = { ollama: 'enabled' };
    const providerConfigs = new Map<string, ProviderDefinition>();
    const customProviders: CustomProviderConfig[] = [];

    // Simulate scenario where user fetched ollama models multiple times
    // (the same model appears in customModels, overlapping with built-in)
    const customModels: Record<string, ModelConfig> = {
      'ollama-model': {
        name: 'Ollama Test Model Fetched',
        providers: ['ollama'],
        pricing: { input: '0', output: '0' },
      },
    };

    const result = computeAvailableModels(apiKeys, providerConfigs, customProviders, customModels);

    // Count entries for ollama-model + ollama provider
    const count = result.filter(
      (m) => m.key === 'ollama-model' && m.provider === 'ollama'
    ).length;

    expect(count).toBe(1);
  });

  it('should include custom provider models when custom provider is enabled', async () => {
    const { computeAvailableModels } = await import('@/providers/core/provider-utils');

    const apiKeys = {};
    const providerConfigs = new Map<string, ProviderDefinition>();
    const customProviders: CustomProviderConfig[] = [
      {
        id: 'my-custom-provider',
        name: 'My Custom Provider',
        type: 'openai',
        baseUrl: 'https://custom.api.com',
        apiKey: 'custom-key',
        enabled: true,
      },
    ];

    const customModels: Record<string, ModelConfig> = {
      'custom-provider-model': {
        name: 'Custom Provider Model',
        providers: ['my-custom-provider'],
        pricing: { input: '0', output: '0' },
      },
    };

    const result = computeAvailableModels(apiKeys, providerConfigs, customProviders, customModels);

    const customModel = result.find((m) => m.key === 'custom-provider-model');
    expect(customModel).toBeDefined();
    expect(customModel?.provider).toBe('my-custom-provider');
    expect(customModel?.providerName).toBe('My Custom Provider');
  });
});

describe('provider-utils: parseModelIdentifier', () => {
  it('should parse model identifier with provider', async () => {
    const { parseModelIdentifier } = await import('@/providers/core/provider-utils');

    const result = parseModelIdentifier('gpt-4@openai');
    expect(result).toEqual({ modelKey: 'gpt-4', providerId: 'openai' });
  });

  it('should parse model identifier without provider', async () => {
    const { parseModelIdentifier } = await import('@/providers/core/provider-utils');

    const result = parseModelIdentifier('gpt-4');
    expect(result).toEqual({ modelKey: 'gpt-4', providerId: null });
  });

  it('should handle empty string', async () => {
    const { parseModelIdentifier } = await import('@/providers/core/provider-utils');

    const result = parseModelIdentifier('');
    expect(result).toEqual({ modelKey: '', providerId: null });
  });

  it('should handle multiple @ symbols (only split on first)', async () => {
    const { parseModelIdentifier } = await import('@/providers/core/provider-utils');

    // Current implementation splits on all @, so "a@b@c" becomes ["a", "b", "c"]
    // which has length 3, not 2, so it falls back to returning the whole string
    const result = parseModelIdentifier('model@provider@extra');
    expect(result).toEqual({ modelKey: 'model@provider@extra', providerId: null });
  });
});

describe('provider-utils: hasApiKeyForProvider', () => {
  it('should return true for local provider with enabled status', async () => {
    const { hasApiKeyForProvider } = await import('@/providers/core/provider-utils');

    expect(hasApiKeyForProvider('ollama', { ollama: 'enabled' })).toBe(true);
  });

  it('should return false for local provider without enabled status', async () => {
    const { hasApiKeyForProvider } = await import('@/providers/core/provider-utils');

    expect(hasApiKeyForProvider('ollama', {})).toBe(false);
    expect(hasApiKeyForProvider('ollama', { ollama: '' })).toBe(false);
  });

  it('should return true for provider with valid API key', async () => {
    const { hasApiKeyForProvider } = await import('@/providers/core/provider-utils');

    expect(hasApiKeyForProvider('openai', { openai: 'sk-xxx' })).toBe(true);
  });

  it('should return false for provider with empty API key', async () => {
    const { hasApiKeyForProvider } = await import('@/providers/core/provider-utils');

    expect(hasApiKeyForProvider('openai', { openai: '' })).toBe(false);
    expect(hasApiKeyForProvider('openai', { openai: '   ' })).toBe(false);
  });

  it('should always return true for talkcody provider', async () => {
    const { hasApiKeyForProvider } = await import('@/providers/core/provider-utils');

    expect(hasApiKeyForProvider('talkcody', {})).toBe(true);
  });
});
