export type MultiAccountProviderId = 'openai' | 'anthropic';

export type ProviderAccountAuthType = 'api_key' | 'oauth';

export interface ProviderAccountItem {
  id: string;
  providerId: MultiAccountProviderId;
  authType: ProviderAccountAuthType;
  name: string;
  enabled: boolean;
  priority: number;
  apiKey?: string;
  oauthAccountId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderAccountsConfig {
  providerId: MultiAccountProviderId;
  accounts: ProviderAccountItem[];
}

export interface ProviderCredentialOverride {
  providerId: MultiAccountProviderId;
  accountId: string;
  authType: ProviderAccountAuthType;
  apiKey?: string;
  useStoredOAuth?: boolean;
  oauthAccountId?: string | null;
}

export interface ResolvedProviderAccount extends ProviderAccountItem {
  apiKey?: string;
}

export interface ProviderSwitchAttempt {
  accountId: string;
  accountName: string;
  reason: string;
}
