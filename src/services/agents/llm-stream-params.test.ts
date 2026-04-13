import { describe, expect, it } from 'vitest';
import { LLMStreamParams } from './llm-stream-params';

describe('LLMStreamParams credential overrides', () => {
  it('includes oauthAccountId in providerOptions credentialOverride', () => {
    const result = LLMStreamParams.build({
      modelIdentifier: 'gpt-5@openai',
      reasoningEffort: 'medium',
      enableReasoningOptions: true,
      credentialOverride: {
        providerId: 'openai',
        accountId: 'acct_openai_1',
        authType: 'oauth',
        useStoredOAuth: true,
        oauthAccountId: 'acct_openai_1',
      },
    });

    expect(result.providerOptions).toMatchObject({
      openai: {
        reasoningEffort: 'medium',
        credentialOverride: {
          accountId: 'acct_openai_1',
          authType: 'oauth',
          useStoredOAuth: true,
          oauthAccountId: 'acct_openai_1',
        },
      },
    });
  });

  it('merges credential override into existing provider options without dropping API key override', () => {
    const result = LLMStreamParams.build({
      modelIdentifier: 'claude-sonnet-4@anthropic',
      reasoningEffort: 'high',
      enableReasoningOptions: true,
      credentialOverride: {
        providerId: 'anthropic',
        accountId: 'anthropic-key-1',
        authType: 'api_key',
        apiKey: 'anthropic-secret',
      },
    });

    expect(result.providerOptions).toMatchObject({
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 12_000 },
        credentialOverride: {
          accountId: 'anthropic-key-1',
          authType: 'api_key',
          apiKey: 'anthropic-secret',
        },
      },
    });
  });

  it('omits oauthAccountId when not provided', () => {
    const providerOptions = LLMStreamParams.buildProviderOptions({
      modelIdentifier: 'gpt-5-mini@openai',
      reasoningEffort: 'low',
      enableReasoningOptions: false,
      credentialOverride: {
        providerId: 'openai',
        accountId: 'fallback-id',
        authType: 'oauth',
        useStoredOAuth: true,
      },
    });

    expect(providerOptions).toEqual({
      openai: {
        credentialOverride: {
          accountId: 'fallback-id',
          authType: 'oauth',
          useStoredOAuth: true,
        },
      },
    });
  });
});
