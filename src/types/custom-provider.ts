// src/types/custom-provider.ts

export type CustomProviderType = 'openai-compatible' | 'anthropic';

export interface CustomProviderConfig {
  id: string;
  name: string;
  type: CustomProviderType;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  description?: string;
}

/**
 * Complete custom providers configuration with version info
 */
export interface CustomProvidersConfiguration {
  version: string; // ISO 8601 timestamp
  providers: Record<string, CustomProviderConfig>;
}

/**
 * Validation result for custom provider configuration
 */
export interface CustomProviderValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Test result for custom provider connectivity
 */
export interface CustomProviderTestResult {
  success: boolean;
  error?: string;
  responseTime?: number;
  models?: string[];
}
