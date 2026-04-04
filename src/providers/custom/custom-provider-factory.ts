// src/providers/custom-provider-factory.ts
export type CustomProviderPlaceholder = {
  providerId: string;
  baseUrl?: string;
  type: 'openai-compatible' | 'anthropic';
  requiresAuth: boolean;
};

/**
 * Factory placeholder for custom providers.
 *
 * Provider creation is now handled by Rust, so we only return metadata
 * describing the provider. This keeps the frontend free of AI SDK runtime.
 */
export function createCustomProvider(config: {
  id: string;
  type: 'openai-compatible' | 'anthropic';
  baseUrl: string;
}): CustomProviderPlaceholder {
  return {
    providerId: config.id,
    baseUrl: config.baseUrl,
    type: config.type,
    requiresAuth: true,
  };
}
