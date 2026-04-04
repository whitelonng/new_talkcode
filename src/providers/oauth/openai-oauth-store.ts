// src/providers/oauth/openai-oauth-store.ts
// Zustand store for OpenAI ChatGPT OAuth state management

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { logger } from '@/lib/logger';
import { llmClient } from '@/services/llm/llm-client';
import { exchangeCode, startOAuthFlow } from './openai-oauth-service';

const OPENAI_OAUTH_CALLBACK_PATH = '/auth/callback';

// OAuth callback result from Rust server
interface OAuthCallbackResult {
  success: boolean;
  code: string | null;
  state: string | null;
  error: string | null;
}

interface OpenAIOAuthState {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Token metadata (in-memory)
  expiresAt: number | null;
  accountId: string | null;
  redirectUri: string | null;

  // OAuth flow state (temporary during flow)
  verifier: string | null;
  expectedState: string | null;

  // Initialization
  isInitialized: boolean;

  // Callback server state
  callbackServerPort: number | null;
  callbackUnlisten: UnlistenFn | null;
}

interface OpenAIOAuthActions {
  // Initialize from storage
  initialize: () => Promise<void>;

  // OAuth flow
  startOAuth: () => Promise<string>;
  startOAuthWithAutoCallback: () => Promise<string>;
  completeOAuth: (code: string) => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  cleanupCallbackListener: () => void;
}

type OpenAIOAuthStore = OpenAIOAuthState & OpenAIOAuthActions;

async function loadOAuthSnapshot() {
  try {
    return await llmClient.getOAuthStatus();
  } catch (error) {
    logger.warn('[OpenAIOAuth] Failed to read OAuth status from Rust:', error);
    return null;
  }
}

export const useOpenAIOAuthStore = create<OpenAIOAuthStore>((set, get) => ({
  // Initial state
  isConnected: false,
  isLoading: false,
  error: null,
  expiresAt: null,
  accountId: null,
  redirectUri: null,
  verifier: null,
  expectedState: null,
  isInitialized: false,
  callbackServerPort: null,
  callbackUnlisten: null,

  // Initialize from storage
  initialize: async () => {
    const { isInitialized, isLoading } = get();
    if (isInitialized || isLoading) return;

    set({ isLoading: true, error: null });

    try {
      logger.info('[OpenAIOAuth] Initializing store');

      const snapshot = await loadOAuthSnapshot();
      const isConnected = snapshot?.openai?.isConnected || false;
      const hasRefreshToken = snapshot?.openai?.hasRefreshToken || false;
      const expiresAt = snapshot?.openai?.expiresAt || null;
      const accountId = snapshot?.openai?.accountId || null;

      logger.info('[OpenAIOAuth] Initialized', { isConnected, hasRefreshToken });

      set({
        isConnected: isConnected || hasRefreshToken,
        expiresAt,
        accountId,
        redirectUri: null,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      logger.error('[OpenAIOAuth] Initialization error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  // Start OAuth flow - returns URL to open in browser
  startOAuth: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await startOAuthFlow();

      set({
        verifier: result.verifier,
        expectedState: result.state,
        isLoading: false,
      });

      logger.info('[OpenAIOAuth] OAuth flow started');
      return result.url;
    } catch (error) {
      logger.error('[OpenAIOAuth] Failed to start OAuth:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to start OAuth',
        isLoading: false,
      });
      throw error;
    }
  },

  // Start OAuth with automatic callback handling via Rust HTTP server
  startOAuthWithAutoCallback: async () => {
    // Cleanup any previous listener
    get().cleanupCallbackListener();

    set({ isLoading: true, error: null });

    try {
      // Start the callback server first to determine the actual port
      const port = await invoke<number>('start_oauth_callback_server', {
        expectedState: undefined,
      });

      if (port !== 1455) {
        logger.warn('[OpenAIOAuth] Default port was in use, using alternative port:', port);
      }

      logger.info('[OpenAIOAuth] Callback server started on port:', port);

      const redirectUri = `http://localhost:${port}${OPENAI_OAUTH_CALLBACK_PATH}`;

      // Generate OAuth flow with the actual redirect URI
      const oauthResult = await startOAuthFlow(redirectUri);

      // Listen for callback event
      const unlisten = await listen<OAuthCallbackResult>('openai-oauth-callback', async (event) => {
        const result = event.payload;
        logger.info('[OpenAIOAuth] Callback received:', result);

        if (result.success && result.code) {
          if (result.state !== oauthResult.state) {
            logger.error('[OpenAIOAuth] OAuth state mismatch on callback', {
              expected: oauthResult.state,
              received: result.state,
            });
            set({
              error: 'OAuth state mismatch',
              isLoading: false,
            });
            get().cleanupCallbackListener();
            return;
          }

          // Auto-complete OAuth flow
          try {
            await get().completeOAuth(result.code);
            logger.info('[OpenAIOAuth] Auto OAuth completed successfully');
          } catch (err) {
            logger.error('[OpenAIOAuth] Failed to complete auto OAuth:', err);
            set({
              error: err instanceof Error ? err.message : 'Failed to complete OAuth',
              isLoading: false,
            });
          }
        } else if (result.error) {
          logger.error('[OpenAIOAuth] Callback error:', result.error);
          set({
            error: result.error,
            isLoading: false,
          });
        }

        // Cleanup listener after receiving callback
        get().cleanupCallbackListener();
      });

      set({
        verifier: oauthResult.verifier,
        expectedState: oauthResult.state,
        redirectUri,
        callbackServerPort: port,
        callbackUnlisten: unlisten,
        isLoading: false,
      });

      logger.info('[OpenAIOAuth] OAuth with auto callback started');
      return oauthResult.url;
    } catch (error) {
      logger.error('[OpenAIOAuth] Failed to start OAuth with auto callback:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to start OAuth',
        isLoading: false,
      });
      throw error;
    }
  },

  // Cleanup callback listener
  cleanupCallbackListener: () => {
    const { callbackUnlisten } = get();
    if (callbackUnlisten) {
      callbackUnlisten();
      set({ callbackUnlisten: null, callbackServerPort: null });
      logger.info('[OpenAIOAuth] Callback listener cleaned up');
    }
  },

  // Complete OAuth flow with authorization code (or full callback URL)
  completeOAuth: async (code: string) => {
    const { verifier, expectedState, redirectUri } = get();

    if (!verifier) {
      throw new Error('No verifier found. Please start OAuth flow first.');
    }

    set({ isLoading: true, error: null });

    try {
      const result = await exchangeCode(
        code,
        verifier,
        expectedState || undefined,
        redirectUri || undefined
      );

      if (result.type === 'failed' || !result.tokens) {
        throw new Error(result.error || 'Token exchange failed');
      }

      const { expiresAt, accountId } = result.tokens;

      logger.info('[OpenAIOAuth] OAuth completed successfully');

      set({
        isConnected: true,
        expiresAt,
        accountId: accountId || null,
        verifier: null,
        expectedState: null,
        redirectUri: null,
        isLoading: false,
      });
    } catch (error) {
      logger.error('[OpenAIOAuth] Failed to complete OAuth:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to complete OAuth',
        verifier: null,
        expectedState: null,
        redirectUri: null,
        isLoading: false,
      });
      throw error;
    }
  },

  // Refresh tokens via Rust
  refreshTokens: async () => {
    const { isLoading } = get();

    if (isLoading) {
      logger.debug('[OpenAIOAuth] Already busy, skipping token refresh');
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const tokens = await llmClient.refreshOpenAIOAuthFromStore();

      logger.info('[OpenAIOAuth] Token refreshed successfully');

      set({
        isConnected: true,
        expiresAt: tokens.expiresAt,
        accountId: tokens.accountId || null,
        isLoading: false,
      });

      return true;
    } catch (error) {
      logger.error('[OpenAIOAuth] Token refresh failed:', error);
      set({
        error: error instanceof Error ? error.message : 'Token refresh failed',
        isLoading: false,
      });
      return false;
    }
  },

  // Disconnect and clear tokens
  disconnect: async () => {
    set({ isLoading: true, error: null });

    try {
      await llmClient.disconnectOpenAIOAuth();

      logger.info('[OpenAIOAuth] Disconnected');

      set({
        isConnected: false,
        expiresAt: null,
        accountId: null,
        redirectUri: null,
        isLoading: false,
      });
    } catch (error) {
      logger.error('[OpenAIOAuth] Failed to disconnect:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to disconnect',
        isLoading: false,
      });
      throw error;
    }
  },
}));

// Selector for connection status
export const selectIsOpenAIOAuthConnected = (state: OpenAIOAuthStore) => state.isConnected;

// Export async helper for checking OAuth status
export async function isOpenAIOAuthConnected(): Promise<boolean> {
  const store = useOpenAIOAuthStore.getState();
  if (!store.isInitialized) {
    await store.initialize();
  }
  return useOpenAIOAuthStore.getState().isConnected;
}

// Export async helper for getting account ID
export async function getOpenAIOAuthAccountId(): Promise<string | null> {
  const store = useOpenAIOAuthStore.getState();
  if (!store.isInitialized) {
    await store.initialize();
  }
  return useOpenAIOAuthStore.getState().accountId;
}

/**
 * @deprecated Tokens are now managed by the Rust backend. This function returns null.
 * Use the Rust backend to make authenticated API calls instead.
 */
export async function getOpenAIOAuthAccessToken(): Promise<string | null> {
  // Tokens are now managed internally by the Rust backend
  return null;
}
