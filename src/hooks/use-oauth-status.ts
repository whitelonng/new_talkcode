// src/hooks/use-oauth-status.ts
// Unified OAuth Status Hook
// Centralized access to all OAuth providers' connection status

import { useGitHubCopilotOAuthStore } from '@/providers/oauth/github-copilot-oauth-store';
import { useOpenAIOAuthStore } from '@/providers/oauth/openai-oauth-store';

/**
 * OAuth connection status map type
 * Maps provider IDs to their connection status
 */
export type OAuthStatusMap = {
  openai: boolean;
  github_copilot: boolean;
};

/**
 * Unified OAuth Status Hook
 *
 * Returns connection status for all OAuth-enabled providers.
 * This hook consolidates all OAuth store subscriptions in one place,
 * eliminating the need for individual store imports in components.
 *
 * @example
 * ```tsx
 * const oauthStatus = useOAuthStatus();
 * const isAnthropicConnected = oauthStatus.anthropic;
 * const isOpenAIConnected = oauthStatus.openai;
 * ```
 */
export function useOAuthStatus(): OAuthStatusMap {
  const openaiConnected = useOpenAIOAuthStore((state) => state.isConnected);
  const githubCopilotConnected = useGitHubCopilotOAuthStore((state) => state.isConnected);

  return {
    openai: openaiConnected,
    github_copilot: githubCopilotConnected,
  };
}

/**
 * Check if a specific provider is OAuth-connected
 *
 * @param providerId - The provider ID to check
 * @returns true if the provider is connected via OAuth, false otherwise
 *
 * @example
 * ```tsx
 * const isConnected = useIsOAuthConnected('anthropic');
 * ```
 */
export function useIsOAuthConnected(providerId: string): boolean {
  const status = useOAuthStatus();
  return status[providerId as keyof OAuthStatusMap] || false;
}
