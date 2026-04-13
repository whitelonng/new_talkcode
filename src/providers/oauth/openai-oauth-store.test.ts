import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useOpenAIOAuthStore } from './openai-oauth-store';
import { llmClient } from '@/services/llm/llm-client';
import { exchangeCode, startOAuthFlow } from './openai-oauth-service';

vi.mock('./openai-oauth-service', () => ({
  startOAuthFlow: vi.fn(),
  exchangeCode: vi.fn(),
}));

vi.mock('@/services/llm/llm-client', () => ({
  llmClient: {
    getOAuthStatus: vi.fn(),
    refreshOpenAIOAuthFromStore: vi.fn(),
    disconnectOpenAIOAuth: vi.fn(),
  },
}));

const mockStartOAuthFlow = startOAuthFlow as Mock;
const mockExchangeCode = exchangeCode as Mock;

function resetStore() {
  useOpenAIOAuthStore.setState({
    isConnected: false,
    isLoading: false,
    error: null,
    expiresAt: null,
    accountId: null,
    accounts: [],
    redirectUri: null,
    verifier: null,
    expectedState: null,
    isInitialized: false,
    callbackServerPort: null,
    callbackUnlisten: null,
  });
}

describe('OpenAIOAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  afterEach(() => {
    useOpenAIOAuthStore.getState().cleanupCallbackListener();
  });

  it('initialize loads multiple OAuth accounts from snapshot', async () => {
    (llmClient.getOAuthStatus as Mock).mockResolvedValue({
      openai: {
        isConnected: true,
        hasRefreshToken: true,
        expiresAt: 2000,
        accountId: 'acct_active',
        accounts: [
          { accountId: 'acct_active', expiresAt: 2000, isConnected: true },
          { accountId: 'acct_backup', expiresAt: 3000, isConnected: true },
        ],
      },
    });

    await useOpenAIOAuthStore.getState().initialize();

    const state = useOpenAIOAuthStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.accountId).toBe('acct_active');
    expect(state.accounts).toHaveLength(2);
    expect(state.accounts.map((account) => account.oauthAccountId)).toEqual([
      'acct_active',
      'acct_backup',
    ]);
    expect(state.accounts[0]?.name).toContain('acct_active');
  });

  it('completeOAuth refreshes account list after adding a new OAuth account', async () => {
    useOpenAIOAuthStore.setState({
      verifier: 'verifier-1',
      expectedState: 'state-1',
      redirectUri: 'http://localhost:1455/auth/callback',
      isInitialized: true,
    });

    mockExchangeCode.mockResolvedValue({
      type: 'success',
      tokens: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: 4000,
        accountId: 'acct_new',
      },
    });

    (llmClient.getOAuthStatus as Mock).mockResolvedValue({
      openai: {
        isConnected: true,
        hasRefreshToken: true,
        expiresAt: 4000,
        accountId: 'acct_new',
        accounts: [
          { accountId: 'acct_old', expiresAt: 3000, isConnected: true },
          { accountId: 'acct_new', expiresAt: 4000, isConnected: true },
        ],
      },
    });

    await useOpenAIOAuthStore.getState().completeOAuth('code-123');

    expect(mockExchangeCode).toHaveBeenCalledWith(
      'code-123',
      'verifier-1',
      'state-1',
      'http://localhost:1455/auth/callback'
    );
    expect(useOpenAIOAuthStore.getState().accounts.map((account) => account.oauthAccountId)).toEqual(
      ['acct_old', 'acct_new']
    );
  });

  it('refreshTokens passes accountId through and refreshes snapshot', async () => {
    (llmClient.refreshOpenAIOAuthFromStore as Mock).mockResolvedValue({
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
      expiresAt: 5000,
      accountId: 'acct_backup',
    });
    (llmClient.getOAuthStatus as Mock).mockResolvedValue({
      openai: {
        isConnected: true,
        accountId: 'acct_backup',
        expiresAt: 5000,
        accounts: [
          { accountId: 'acct_active', expiresAt: 2000, isConnected: true },
          { accountId: 'acct_backup', expiresAt: 5000, isConnected: true },
        ],
      },
    });

    const ok = await useOpenAIOAuthStore.getState().refreshTokens('acct_backup');

    expect(ok).toBe(true);
    expect(llmClient.refreshOpenAIOAuthFromStore).toHaveBeenCalledWith({ accountId: 'acct_backup' });
    expect(useOpenAIOAuthStore.getState().accountId).toBe('acct_backup');
    expect(useOpenAIOAuthStore.getState().accounts).toHaveLength(2);
  });

  it('disconnect passes accountId through and keeps remaining accounts', async () => {
    (llmClient.disconnectOpenAIOAuth as Mock).mockResolvedValue(undefined);
    (llmClient.getOAuthStatus as Mock).mockResolvedValue({
      openai: {
        isConnected: true,
        accountId: 'acct_backup',
        expiresAt: 6000,
        accounts: [{ accountId: 'acct_backup', expiresAt: 6000, isConnected: true }],
      },
    });

    await useOpenAIOAuthStore.getState().disconnect('acct_active');

    expect(llmClient.disconnectOpenAIOAuth).toHaveBeenCalledWith({ accountId: 'acct_active' });
    expect(useOpenAIOAuthStore.getState().accountId).toBe('acct_backup');
    expect(useOpenAIOAuthStore.getState().accounts.map((account) => account.oauthAccountId)).toEqual([
      'acct_backup',
    ]);
  });

  it('startOAuth stores verifier and expected state for another account authorization', async () => {
    mockStartOAuthFlow.mockResolvedValue({
      url: 'https://auth.openai.com/oauth/authorize?x=1',
      verifier: 'verifier-2',
      state: 'state-2',
    });

    const url = await useOpenAIOAuthStore.getState().startOAuth();

    expect(url).toContain('auth.openai.com');
    expect(useOpenAIOAuthStore.getState().verifier).toBe('verifier-2');
    expect(useOpenAIOAuthStore.getState().expectedState).toBe('state-2');
  });
});
