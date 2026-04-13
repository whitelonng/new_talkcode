import { describe, expect, it } from 'vitest';
import type { ProviderAccountItem } from '@/types/provider-accounts';
import {
  buildCredentialOverrides,
  getProviderAccounts,
  saveProviderAccounts,
} from './provider-account-service';

describe('provider-account-service', () => {
  it('buildCredentialOverrides preserves oauthAccountId for OpenAI OAuth accounts', () => {
    const accounts: ProviderAccountItem[] = [
      {
        id: 'local-oauth-row',
        providerId: 'openai',
        authType: 'oauth',
        name: 'OAuth A',
        enabled: true,
        priority: 1,
        oauthAccountId: 'acct_oauth_a',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'api-key-row',
        providerId: 'openai',
        authType: 'api_key',
        name: 'API Key A',
        enabled: true,
        priority: 0,
        apiKey: ' sk-test-123 ',
        createdAt: 1,
        updatedAt: 2,
      },
    ];

    const overrides = buildCredentialOverrides('openai', accounts);

    expect(overrides).toEqual([
      {
        providerId: 'openai',
        accountId: 'api-key-row',
        authType: 'api_key',
        apiKey: 'sk-test-123',
        useStoredOAuth: false,
        oauthAccountId: null,
      },
      {
        providerId: 'openai',
        accountId: 'acct_oauth_a',
        authType: 'oauth',
        apiKey: undefined,
        useStoredOAuth: true,
        oauthAccountId: 'acct_oauth_a',
      },
    ]);
  });

  it('falls back to local id when oauthAccountId is missing', () => {
    const overrides = buildCredentialOverrides('openai', [
      {
        id: 'openai-oauth-local-id',
        providerId: 'openai',
        authType: 'oauth',
        name: 'OAuth Fallback',
        enabled: true,
        priority: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    expect(overrides).toEqual([
      {
        providerId: 'openai',
        accountId: 'openai-oauth-local-id',
        authType: 'oauth',
        apiKey: undefined,
        useStoredOAuth: true,
        oauthAccountId: 'openai-oauth-local-id',
      },
    ]);
  });

  it('ignores unsupported oauth providers and disabled/empty accounts', () => {
    const anthropicOverrides = buildCredentialOverrides('anthropic', [
      {
        id: 'anthropic-oauth',
        providerId: 'anthropic',
        authType: 'oauth',
        name: 'Anthropic OAuth',
        enabled: true,
        priority: 0,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'anthropic-key',
        providerId: 'anthropic',
        authType: 'api_key',
        name: 'Anthropic Key',
        enabled: true,
        priority: 1,
        apiKey: 'ak-live',
        createdAt: 1,
        updatedAt: 2,
      },
      {
        id: 'disabled-openai-key',
        providerId: 'anthropic',
        authType: 'api_key',
        name: 'Disabled',
        enabled: false,
        priority: 2,
        apiKey: 'ignored',
        createdAt: 1,
        updatedAt: 3,
      },
    ]);

    expect(anthropicOverrides).toEqual([
      {
        providerId: 'anthropic',
        accountId: 'anthropic-key',
        authType: 'api_key',
        apiKey: 'ak-live',
        useStoredOAuth: false,
        oauthAccountId: null,
      },
    ]);
  });

  it('merges stored accounts with legacy api key and normalizes order', async () => {
    const raw = JSON.stringify({
      providerId: 'openai',
      accounts: [
        {
          id: 'oauth-b',
          providerId: 'openai',
          authType: 'oauth',
          name: 'OAuth B',
          enabled: true,
          priority: 3,
          oauthAccountId: 'acct_b',
          createdAt: 10,
          updatedAt: 30,
        },
        {
          id: 'api-a',
          providerId: 'openai',
          authType: 'api_key',
          name: 'API A',
          enabled: true,
          priority: 1,
          apiKey: 'sk-a',
          createdAt: 10,
          updatedAt: 20,
        },
      ],
    });

    const result = await getProviderAccounts('openai', {
      rawValue: raw,
      legacyApiKey: 'sk-legacy',
    });

    expect(result.map((account) => ({ id: account.id, priority: account.priority }))).toEqual([
      { id: 'api-a', priority: 0 },
      { id: 'openai-legacy-api-key', priority: 1 },
      { id: 'oauth-b', priority: 2 },
    ]);
  });

  it('saveProviderAccounts keeps empty api-key rows and oauth rows for user editing', async () => {
    const payload = await saveProviderAccounts('openai', [
      {
        id: 'empty-api',
        providerId: 'openai',
        authType: 'api_key',
        name: 'Empty API',
        enabled: true,
        priority: 0,
        apiKey: '',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'oauth-1',
        providerId: 'openai',
        authType: 'oauth',
        name: 'OAuth 1',
        enabled: true,
        priority: 1,
        oauthAccountId: 'acct_1',
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    expect(payload).not.toBeUndefined();
    const parsed = JSON.parse(payload as string) as {
      providerId: string;
      accounts: Array<{ id: string; authType: string }>;
    };
    expect(parsed.providerId).toBe('openai');
    expect(parsed.accounts).toHaveLength(2);
    expect(parsed.accounts[0]).toMatchObject({
      id: 'empty-api',
      authType: 'api_key',
      providerId: 'openai',
      priority: 0,
    });
    expect(parsed.accounts[1]).toMatchObject({
      id: 'oauth-1',
      authType: 'oauth',
      oauthAccountId: 'acct_1',
      providerId: 'openai',
      priority: 1,
    });
  });
});
