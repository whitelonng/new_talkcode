/**
 * Model configuration type definitions
 * Shared between frontend and backend
 */

export interface ModelConfig {
  name: string;
  imageInput?: boolean;
  videoInput?: boolean;
  audioInput?: boolean;
  imageOutput?: boolean;
  interleaved?: boolean; // Indicates interleaved thinking capability
  providers: string[]; // Will be validated against ProviderIds at runtime
  providerMappings?: Record<string, string>;
  pricing?: { input: string; output: string; cachedInput?: string; cacheCreation?: string };
  context_length?: number;
}

export interface ModelsConfiguration {
  version: string; // ISO 8601 timestamp
  models: Record<string, ModelConfig>;
}

export interface ModelVersionResponse {
  version: string; // ISO 8601 timestamp
}

export type ModelKey = string;
