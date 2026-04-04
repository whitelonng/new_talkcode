// src/providers/core/provider-registry.ts
import { PROVIDER_CONFIGS } from '@/providers/config/provider-config';
import type { ProviderDefinition } from '@/types';

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, ProviderDefinition> = new Map();

  private constructor() {
    for (const [id, definition] of Object.entries(PROVIDER_CONFIGS)) {
      this.providers.set(id, definition);
    }
  }

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  getProvider(id: string): ProviderDefinition | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): ProviderDefinition[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = ProviderRegistry.getInstance();
