// src/providers/oauth/openai-oauth-service.ts
// Core OAuth service for OpenAI ChatGPT Plus/Pro authentication (Rust-backed).

import { logger } from '@/lib/logger';
import { llmClient } from '@/services/llm/llm-client';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const OAUTH_REDIRECT_URI = 'http://localhost:1455/auth/callback';
const OAUTH_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const OAUTH_SCOPE = 'openid profile email offline_access';

export interface OpenAIOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  accountId?: string; // ChatGPT account ID extracted from JWT
}

export interface OAuthFlowResult {
  url: string;
  verifier: string;
  state: string;
}

export interface TokenExchangeResult {
  type: 'success' | 'failed';
  tokens?: OpenAIOAuthTokens;
  error?: string;
}

export interface ParsedAuthInput {
  code?: string;
  state?: string;
}

export interface JWTPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  'https://api.openai.com/auth'?: {
    user_id?: string;
  };
}

const OAUTH_EXTRA_PARAMS = {
  id_token_add_organizations: 'true',
  codex_cli_simplified_flow: 'true',
  originator: 'codex_cli_rs',
};

function normalizeExpiresAt(expiresAt: number): number {
  return expiresAt < 1_000_000_000_000 ? expiresAt * 1000 : expiresAt;
}

/**
 * Start OAuth flow - generates authorization URL via Rust.
 */
export async function startOAuthFlow(redirectUri?: string): Promise<OAuthFlowResult> {
  logger.info('[OpenAIOAuth] Starting OAuth flow via Rust');
  return llmClient.startOpenAIOAuth(redirectUri ? { redirectUri } : undefined);
}

export function buildAuthorizeUrl(params: {
  redirectUri?: string;
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL(OAUTH_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', params.redirectUri ?? OAUTH_REDIRECT_URI);
  url.searchParams.set('scope', OAUTH_SCOPE);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  Object.entries(OAUTH_EXTRA_PARAMS).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

/**
 * Parse authorization code and state from user input
 * Supports multiple formats:
 * - Full URL: http://localhost:1455/auth/callback?code=xxx&state=yyy
 * - Code#State: xxx#yyy
 * - Query string: code=xxx&state=yyy
 * - Just code: xxx
 */
export function parseAuthorizationInput(input: string): ParsedAuthInput {
  const value = (input || '').trim();
  if (!value) return {};

  // Try to parse as URL
  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get('code') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
    };
  } catch {
    // Not a URL, continue with other formats
  }

  // Try code#state format
  if (value.includes('#')) {
    const [code, state] = value.split('#', 2);
    return { code, state };
  }

  // Try query string format
  if (value.includes('code=')) {
    const params = new URLSearchParams(value);
    return {
      code: params.get('code') ?? undefined,
      state: params.get('state') ?? undefined,
    };
  }

  // Assume it's just the code
  return { code: value };
}

/**
 * Exchange authorization code for tokens via Rust.
 */
export async function exchangeCode(
  code: string,
  verifier: string,
  expectedState?: string,
  redirectUri?: string
): Promise<TokenExchangeResult> {
  try {
    const parsed = parseAuthorizationInput(code);
    const authCode = parsed.code || code;
    const state = expectedState ?? parsed.state;

    if (!state) {
      return {
        type: 'failed',
        error: 'Missing OAuth state parameter',
      };
    }

    logger.info('[OpenAIOAuth] Exchanging code via Rust');
    const tokens = await llmClient.completeOpenAIOAuth({
      code: authCode,
      verifier,
      expectedState: state,
      redirectUri,
    });
    return {
      type: 'success',
      tokens: {
        ...tokens,
        expiresAt: normalizeExpiresAt(tokens.expiresAt),
      },
    };
  } catch (error) {
    logger.error('[OpenAIOAuth] Token exchange error:', error);
    return {
      type: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Refresh an expired access token via Rust.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenExchangeResult> {
  try {
    logger.info('[OpenAIOAuth] Refreshing access token via Rust');
    const tokens = await llmClient.refreshOpenAIOAuth({ refreshToken });
    return {
      type: 'success',
      tokens: {
        ...tokens,
        expiresAt: normalizeExpiresAt(tokens.expiresAt),
      },
    };
  } catch (error) {
    logger.error('[OpenAIOAuth] Token refresh error:', error);
    return {
      type: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if token is expired or about to expire (within 1 minute)
 */
export function isTokenExpired(expiresAt: number): boolean {
  const bufferMs = 60 * 1000; // 1 minute buffer
  return Date.now() + bufferMs >= expiresAt;
}

export function getRedirectUri(): string {
  return OAUTH_REDIRECT_URI;
}

export function getClientId(): string {
  return CLIENT_ID;
}
