// src/components/settings/oauth-provider-input.tsx
// Unified OAuth provider input component
// Handles OAuth login with API key fallback for all OAuth-enabled providers

import { ChevronDown, ChevronRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { GitHubCopilotOAuthLogin } from '@/components/settings/github-copilot-oauth-login';
import { OpenAIOAuthLogin } from '@/components/settings/openai-oauth-login';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/hooks/use-locale';
import type { ProviderDefinition } from '@/types';

/**
 * OAuth Login Component Registry
 * Maps provider IDs to their corresponding OAuth login components
 */
const OAUTH_COMPONENTS: Record<string, React.ComponentType> = {
  openai: OpenAIOAuthLogin,
  github_copilot: GitHubCopilotOAuthLogin,
};

interface OAuthProviderInputProps {
  providerId: string;
  config: ProviderDefinition;
  currentKey: string;
  isVisible: boolean;
  onApiKeyChange: (providerId: string, value: string) => void;
  onTestConnection: (providerId: string) => void;
  toggleVisibility: (providerId: string) => void;
  testingProvider: string | null;
}

/**
 * OAuth Provider Input Component
 *
 * Displays OAuth login UI with collapsible API key fallback.
 * This component eliminates the need for provider-specific rendering logic
 * by using a component registry pattern.
 *
 * When adding a new OAuth provider:
 * 1. Create the OAuth login component (e.g., XxxOAuthLogin.tsx)
 * 2. Add it to OAUTH_COMPONENTS registry above
 * 3. Add OAuth config in oauth-config.ts
 * 4. Add store hook in use-oauth-status.ts
 */
export function OAuthProviderInput({
  providerId,
  config,
  currentKey,
  isVisible,
  onApiKeyChange,
  onTestConnection,
  toggleVisibility,
  testingProvider,
}: OAuthProviderInputProps) {
  const { t } = useLocale();
  const [showApiKeyFallback, setShowApiKeyFallback] = useState(false);

  // Get the corresponding OAuth component from registry
  const OAuthComponent = OAUTH_COMPONENTS[providerId];

  if (!OAuthComponent) {
    // Fallback to regular API key input if no OAuth component is registered
    console.warn(`No OAuth component found for provider: ${providerId}`);
    return null;
  }

  // Providers that ONLY support OAuth (no API key fallback)
  const oauthOnlyProviders = ['github_copilot'];
  const isOAuthOnly = oauthOnlyProviders.includes(providerId);

  return (
    <div className="space-y-4">
      {/* OAuth Login Component */}
      <OAuthComponent />

      {/* API Key fallback (collapsible) - Hidden for OAuth-only providers */}
      {!isOAuthOnly && (
        <Collapsible open={showApiKeyFallback} onOpenChange={setShowApiKeyFallback}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showApiKeyFallback ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {t.Settings.claudeOAuth.useApiKeyInstead}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id={`api-key-${providerId}`}
                  type={isVisible ? 'text' : 'password'}
                  placeholder={t.Settings.apiKeys.enterKey(config.name)}
                  value={currentKey}
                  onChange={(e) => onApiKeyChange(providerId, e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility(providerId)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {currentKey.trim().length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onTestConnection(providerId)}
                  disabled={testingProvider !== null}
                >
                  {testingProvider === providerId ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.Settings.apiKeys.testing}
                    </>
                  ) : (
                    t.Settings.apiKeys.testConnection
                  )}
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
