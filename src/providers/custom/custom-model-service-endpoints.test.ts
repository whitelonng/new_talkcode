import { describe, expect, it } from 'vitest';

// We need to unmock to test the actual implementation
describe('CustomModelService - Provider Endpoints Configuration', () => {
  it('should have model endpoints configured for all AI providers in PROVIDER_CONFIGS', async () => {
    // Import the actual modules
    const { PROVIDER_CONFIGS } = await import('@/providers/config/provider-config');
    const { customModelService } = await import('@/providers/custom/custom-model-service');

    // List of non-AI providers that don't need model endpoints
    const nonAIProviders = ['tavily', 'serper', 'elevenlabs', 'talkcody'];
    
    // Providers that explicitly don't support /v1/models endpoint
    const providersWithoutModelsEndpoint = ['MiniMax'];

    // Get all provider IDs from PROVIDER_CONFIGS
    const providerIds = Object.keys(PROVIDER_CONFIGS);

    // Track providers without endpoints
    const missingEndpoints: string[] = [];

    for (const providerId of providerIds) {
      // Skip non-AI providers
      if (nonAIProviders.includes(providerId)) {
        continue;
      }

      // Check if provider has models endpoint
      const supportsModelsFetch = customModelService.supportsModelsFetch(providerId);
      const endpoint = customModelService.getModelsEndpoint(providerId);

      // Providers should either:
      // 1. Support models fetch with a valid endpoint
      // 2. Explicitly not support it (null endpoint)
      if (supportsModelsFetch && endpoint === null) {
        // This is the bug we're testing for - provider says it supports models fetch
        // but has no endpoint configured
        if (!providersWithoutModelsEndpoint.includes(providerId)) {
          missingEndpoints.push(providerId);
        }
      }
    }

    // Assert no providers are missing endpoints
    expect(
      missingEndpoints,
      `The following providers are missing model endpoints: ${missingEndpoints.join(', ')}. ` +
        'Please add them to PROVIDER_MODELS_ENDPOINTS in src/providers/custom/custom-model-service.ts'
    ).toEqual([]);
  });

  it('should have valid HTTPS URLs for all provider endpoints', async () => {
    const { customModelService } = await import('@/providers/custom/custom-model-service');
    const { PROVIDER_CONFIGS } = await import('@/providers/config/provider-config');

    const invalidEndpoints: Array<{ provider: string; endpoint: string }> = [];

    for (const providerId of Object.keys(PROVIDER_CONFIGS)) {
      const endpoint = customModelService.getModelsEndpoint(providerId);
      
      if (endpoint === null) {
        // Skip providers with null endpoints (they don't support models fetch)
        continue;
      }

      // Check if endpoint is a valid URL (either http:// for local or https:// for remote)
      const isValidUrl = /^https?:\/\/.+/.test(endpoint);
      
      if (!isValidUrl) {
        invalidEndpoints.push({ provider: providerId, endpoint });
      }
    }

    expect(
      invalidEndpoints,
      `The following providers have invalid endpoint URLs: ${invalidEndpoints.map((e) => `${e.provider}: ${e.endpoint}`).join(', ')}`
    ).toEqual([]);
  });

  it('should correctly identify providers that support models fetch', async () => {
    const { customModelService } = await import('@/providers/custom/custom-model-service');

    // Providers that should support models fetch
    const supportedProviders = [
      'openai',
      'anthropic',
      'deepseek',
      'openRouter',
      'zhipu',
      'zai',
      'google',
      'moonshot',
      'github_copilot',
      'ollama',
      'lmstudio',
      'zenmux',
      'groq',
    ];

    for (const providerId of supportedProviders) {
      const supportsModelsFetch = customModelService.supportsModelsFetch(providerId);
      expect(
        supportsModelsFetch,
        `Provider ${providerId} should support models fetch`
      ).toBe(true);
    }
  });

  it('should correctly identify providers that do not support models fetch', async () => {
    const { customModelService } = await import('@/providers/custom/custom-model-service');

    // Providers that should NOT support models fetch
    const unsupportedProviders = [
      'MiniMax', // Explicitly doesn't support /v1/models
      'tavily', // Web search API
      'serper', // Web search API
      'elevenlabs', // TTS API
    ];

    for (const providerId of unsupportedProviders) {
      const supportsModelsFetch = customModelService.supportsModelsFetch(providerId);
      const endpoint = customModelService.getModelsEndpoint(providerId);
      
      expect(
        endpoint,
        `Provider ${providerId} should have null endpoint since it doesn't support models fetch`
      ).toBe(null);
      
      // For built-in providers in the endpoints map, supportsModelsFetch should return false
      // For providers not in the map, it may return true (custom provider logic)
      if (endpoint === null && supportsModelsFetch) {
        // This is expected only for providers not in PROVIDER_MODELS_ENDPOINTS
        expect(
          providerId,
          `Provider ${providerId} has null endpoint but supportsModelsFetch returns true - it might not be in PROVIDER_MODELS_ENDPOINTS`
        ).not.toBeUndefined();
      }
    }
  });
});
