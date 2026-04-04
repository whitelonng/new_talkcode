import { describe, expect, it } from 'vitest';
import { buildAuthorizeUrl, exchangeCode } from './openai-oauth-service';

describe('openai-oauth-service', () => {
  it('buildAuthorizeUrl should use OpenAI OAuth endpoints and include required params', () => {
    const url = buildAuthorizeUrl({
      redirectUri: 'http://localhost:1455/auth/callback',
      codeChallenge: 'challenge-123',
      state: 'state-456',
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://auth.openai.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('app_EMoamEEZ73f0CkXaXp7hrann');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:1455/auth/callback');
    expect(parsed.searchParams.get('scope')).toBe('openid profile email offline_access');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-123');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('state')).toBe('state-456');
    expect(parsed.searchParams.get('id_token_add_organizations')).toBe('true');
    expect(parsed.searchParams.get('codex_cli_simplified_flow')).toBe('true');
    expect(parsed.searchParams.get('originator')).toBe('codex_cli_rs');
  });

  describe('exchangeCode', () => {
    it('should return failed when state is missing', async () => {
      const result = await exchangeCode('code-123', 'verifier-123');
      expect(result.type).toBe('failed');
      expect(result.error).toBe('Missing OAuth state parameter');
    });
  });
});
