import { logger } from '@/lib/logger';
import type {
  MultiAccountProviderId,
  ProviderAccountItem,
  ProviderAccountsConfig,
  ProviderCredentialOverride,
  ProviderSwitchAttempt,
  ResolvedProviderAccount,
} from '@/types/provider-accounts';

const SUPPORTED_MULTI_ACCOUNT_PROVIDERS: MultiAccountProviderId[] = ['openai', 'anthropic'];

function isSupportedProvider(providerId: string): providerId is MultiAccountProviderId {
  return SUPPORTED_MULTI_ACCOUNT_PROVIDERS.includes(providerId as MultiAccountProviderId);
}

function _getStorageKey(providerId: MultiAccountProviderId): string {
  return `provider_accounts_${providerId}`;
}

function createId(
  providerId: MultiAccountProviderId,
  authType: ProviderAccountItem['authType']
): string {
  return `${providerId}-${authType}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortAccounts<T extends { priority: number; updatedAt: number }>(accounts: T[]): T[] {
  return [...accounts].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.updatedAt - b.updatedAt;
  });
}

function normalizePriorities(accounts: ProviderAccountItem[]): ProviderAccountItem[] {
  return sortAccounts(accounts).map((account, index) => ({
    ...account,
    priority: index,
  }));
}

function sanitizeAccount(
  providerId: MultiAccountProviderId,
  account: ProviderAccountItem,
  fallbackIndex: number
): ProviderAccountItem {
  const now = Date.now();
  return {
    id: account.id || createId(providerId, account.authType),
    providerId,
    authType: account.authType,
    name: account.name?.trim() || `${providerId} ${account.authType} ${fallbackIndex + 1}`,
    enabled: account.enabled !== false,
    priority: Number.isFinite(account.priority) ? account.priority : fallbackIndex,
    apiKey: account.apiKey?.trim() || undefined,
    oauthAccountId: account.oauthAccountId ?? null,
    createdAt: Number.isFinite(account.createdAt) ? account.createdAt : now,
    updatedAt: Number.isFinite(account.updatedAt) ? account.updatedAt : now,
  };
}

function parseStoredAccounts(
  raw: string | undefined,
  providerId: MultiAccountProviderId
): ProviderAccountItem[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProviderAccountsConfig>;
    const accounts = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
    return normalizePriorities(
      accounts.map((account, index) =>
        sanitizeAccount(providerId, account as ProviderAccountItem, index)
      )
    );
  } catch (error) {
    logger.warn('[provider-account-service] Failed to parse provider accounts config', {
      providerId,
      error,
    });
    return [];
  }
}

function createLegacyApiKeyAccount(
  providerId: MultiAccountProviderId,
  apiKey: string
): ProviderAccountItem | null {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return null;
  }
  const now = Date.now();
  return {
    id: `${providerId}-legacy-api-key`,
    providerId,
    authType: 'api_key',
    name: 'Default API Key',
    enabled: true,
    priority: 0,
    apiKey: trimmed,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getProviderAccounts(
  providerId: string,
  options?: {
    legacyApiKey?: string | undefined;
    openAiOAuthConnected?: boolean;
    openAiOAuthAccountId?: string | null;
    rawValue?: string | undefined;
  }
): Promise<ProviderAccountItem[]> {
  if (!isSupportedProvider(providerId)) {
    return [];
  }

  const raw = options?.rawValue;
  const storedAccounts = parseStoredAccounts(raw, providerId);

  const legacyAccount = options?.legacyApiKey
    ? createLegacyApiKeyAccount(providerId, options.legacyApiKey)
    : null;

  const merged = [...storedAccounts];
  if (legacyAccount && !merged.some((account) => account.id === legacyAccount.id)) {
    merged.push(legacyAccount);
  }

  return normalizePriorities(merged);
}

export async function saveProviderAccounts(
  providerId: string,
  accounts: ProviderAccountItem[]
): Promise<string | undefined> {
  if (!isSupportedProvider(providerId)) {
    return undefined;
  }

  const normalized = normalizePriorities(
    accounts.map((account, index) => sanitizeAccount(providerId, account, index))
  );

  const payload: ProviderAccountsConfig = {
    providerId,
    accounts: normalized,
  };

  return JSON.stringify(payload);
}

export function buildCredentialOverrides(
  providerId: string,
  accounts: ProviderAccountItem[]
): ProviderCredentialOverride[] {
  if (!isSupportedProvider(providerId)) {
    return [];
  }

  return sortAccounts(accounts)
    .filter((account) => account.enabled)
    .filter((account) => {
      if (account.authType === 'oauth') {
        return providerId === 'openai';
      }
      return !!account.apiKey?.trim();
    })
    .map((account) => ({
      providerId,
      accountId: account.authType === 'oauth' ? (account.oauthAccountId ?? account.id) : account.id,
      authType: account.authType,
      apiKey: account.authType === 'api_key' ? account.apiKey?.trim() : undefined,
      useStoredOAuth: account.authType === 'oauth',
      oauthAccountId: account.authType === 'oauth' ? (account.oauthAccountId ?? account.id) : null,
    }));
}

export function shouldSwitchAccount(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return [
    '401',
    '403',
    '429',
    'unauthorized',
    'forbidden',
    'invalid api key',
    'quota',
    'rate limit',
    'billing',
    'credit',
    'token expired',
    'authentication',
  ].some((hint) => message.includes(hint));
}

export function formatProviderSwitchError(
  providerId: string,
  attempts: ProviderSwitchAttempt[]
): string {
  const details = attempts
    .map((attempt) => `${attempt.accountName} (${attempt.reason})`)
    .join(', ');
  return `${providerId} all enabled accounts failed: ${details}`;
}

export function maskApiKey(value: string | undefined): string {
  if (!value) {
    return '';
  }
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export function createEmptyApiKeyAccount(
  providerId: MultiAccountProviderId,
  name?: string
): ProviderAccountItem {
  const now = Date.now();
  return {
    id: createId(providerId, 'api_key'),
    providerId,
    authType: 'api_key',
    name: name || 'New API Key',
    enabled: true,
    priority: 0,
    apiKey: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function moveAccount(
  accounts: ProviderAccountItem[],
  accountId: string,
  direction: 'up' | 'down'
): ProviderAccountItem[] {
  const sorted = sortAccounts(accounts);
  const index = sorted.findIndex((account) => account.id === accountId);
  if (index < 0) {
    return sorted;
  }
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sorted.length) {
    return sorted;
  }
  const left = sorted[index];
  const right = sorted[swapIndex];
  if (!left || !right) {
    return sorted;
  }

  sorted[index] = right;
  sorted[swapIndex] = left;
  return normalizePriorities(
    sorted.map((account) => ({
      ...account,
      updatedAt: Date.now(),
    }))
  );
}

export function resolveProviderAccounts(
  providerId: string,
  accounts: ProviderAccountItem[]
): ResolvedProviderAccount[] {
  if (!isSupportedProvider(providerId)) {
    return [];
  }

  return sortAccounts(accounts).map((account) => ({
    ...account,
    apiKey: account.authType === 'api_key' ? account.apiKey : undefined,
  }));
}
