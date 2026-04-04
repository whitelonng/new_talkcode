// src/providers/index.ts
// Unified entry point for provider-related exports
//
// Directory Structure:
// └── providers/
//     ├── config/           - Provider and model configuration
//     │   ├── provider-config.ts
//     │   └── model-config.ts
//     ├── core/             - Core provider functionality
//     │   ├── provider-factory.ts
//     │   ├── provider-utils.ts
//     │   └── talkcody-provider.ts
//     ├── custom/           - Custom provider management
//     │   ├── custom-provider-factory.ts
//     │   ├── custom-provider-service.ts
//     │   └── custom-model-service.ts
//     ├── oauth/            - OAuth authentication
//     │   ├── claude-oauth-service.ts
//     │   ├── openai-oauth-service.ts
//     │   ├── claude-oauth-store.ts
//     │   └── openai-oauth-store.ts
//     └── models/           - Model services
//         ├── model-loader.ts
//         ├── model-service.ts
//         └── model-type-service.ts

// Types
export type {
  ProviderDefinition,
  ProviderRegistry as ProviderRegistryInterface,
  ProviderType,
} from '@/types';

// Config exports
export * from './config/provider-config';

// OAuth modules - import directly to avoid naming conflicts:
// - @/providers/oauth/claude-oauth-service
// - @/providers/oauth/openai-oauth-service
// - @/providers/oauth/claude-oauth-store
// - @/providers/oauth/openai-oauth-store
