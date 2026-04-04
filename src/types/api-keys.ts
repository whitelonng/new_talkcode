// src/types/api-keys.ts
import type { ProviderDefinition } from '@/providers';
import type { ProviderIds } from '@/providers/config/provider-config';

// Re-export ProviderDefinition as ProviderConfig for backward compatibility
export type ProviderConfig = ProviderDefinition;

// Generate ApiKeySettings from provider definitions (including custom providers)
export type ApiKeySettings = {
  [K in ProviderIds | string]?: string; // Include custom provider IDs
} & {
  // Custom provider API keys
  [K in `custom_${string}`]?: string;
};

export interface ModelProviderMapping {
  model: string;
  providers: ProviderConfig[];
}

export interface AvailableModel {
  key: string;
  name: string;
  provider: string;
  providerName: string;
  imageInput: boolean;
  imageOutput: boolean;
  audioInput: boolean;
  videoInput: boolean;
  inputPricing?: string;
}

// Custom provider API key mapping
export interface CustomProviderApiKeys {
  [providerId: string]: string;
}
