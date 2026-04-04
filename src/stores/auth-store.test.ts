import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { authService } from '@/services/auth-service';
import { useAuthStore } from './auth-store';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  Toaster: vi.fn(),
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      language: 'en',
      theme: 'dark',
      getAutoApproveEditsGlobal: vi.fn(() => false),
      setAutoApproveEditsGlobal: vi.fn(),
    })),
    subscribe: vi.fn(),
    setState: vi.fn(),
  },
}));

vi.mock('@/services/auth-service', () => ({
  authService: {
    initiateGitHubOAuth: vi.fn(),
    initiateGoogleOAuth: vi.fn(),
    storeAuthToken: vi.fn(),
    fetchUserProfile: vi.fn(),
    signOut: vi.fn(),
    isAuthenticated: vi.fn(),
  },
}));

// Type assertions for mocked functions
const mockStoreAuthToken = authService.storeAuthToken as Mock;
const mockFetchUserProfile = authService.fetchUserProfile as Mock;
const mockInitiateGitHubOAuth = authService.initiateGitHubOAuth as Mock;
const mockInitiateGoogleOAuth = authService.initiateGoogleOAuth as Mock;
const mockIsAuthenticated = authService.isAuthenticated as Mock;
const mockSignOut = authService.signOut as Mock;

describe('AuthStore - OAuth Deep Link Flow', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });

    // Clear all mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleOAuthCallback', () => {
    it('should successfully handle OAuth callback with valid token', async () => {
      // Arrange
      const mockToken = 'valid-jwt-token-123';
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
        displayName: 'Test User',
        oauthProvider: 'github' as const,
        oauthId: 'github-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockStoreAuthToken.mockResolvedValueOnce(undefined);
      mockFetchUserProfile.mockResolvedValueOnce(mockUser);

      // Act
      const { handleOAuthCallback } = useAuthStore.getState();
      await handleOAuthCallback(mockToken);

      // Assert
      expect(authService.storeAuthToken).toHaveBeenCalledWith(mockToken);
      expect(authService.fetchUserProfile).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Signed in successfully');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle OAuth callback when user profile fetch fails', async () => {
      // Arrange
      const mockToken = 'valid-jwt-token-123';

      mockStoreAuthToken.mockResolvedValueOnce(undefined);
      mockFetchUserProfile.mockResolvedValueOnce(null);

      // Act
      const { handleOAuthCallback } = useAuthStore.getState();
      await handleOAuthCallback(mockToken);

      // Assert
      expect(authService.storeAuthToken).toHaveBeenCalledWith(mockToken);
      expect(authService.fetchUserProfile).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Failed to complete sign in');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Failed to fetch user profile');
    });

    it('should handle OAuth callback when token storage fails', async () => {
      // Arrange
      const mockToken = 'valid-jwt-token-123';
      const mockError = new Error('Failed to store token');

      mockStoreAuthToken.mockRejectedValue(mockError);

      // Act
      const { handleOAuthCallback } = useAuthStore.getState();
      await handleOAuthCallback(mockToken);

      // Assert
      expect(authService.storeAuthToken).toHaveBeenCalledWith(mockToken);
      expect(authService.fetchUserProfile).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Failed to complete sign in: Failed to store token');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Failed to store token');
    });

    it('should set loading state during OAuth callback processing', async () => {
      // Arrange
      const fixedDate = '2025-11-10T00:00:00.000Z';
      const mockToken = 'valid-jwt-token-123';
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: undefined,
        displayName: 'Test User',
        oauthProvider: 'github' as const,
        oauthId: 'github-123',
        createdAt: fixedDate,
        updatedAt: fixedDate,
      };

      let storeTokenResolve!: () => void;
      const storeTokenPromise = new Promise<void>((resolve) => {
        storeTokenResolve = resolve;
      });

      mockStoreAuthToken.mockImplementationOnce(async () => {
        // Simulate async operation that keeps loading state true
        await new Promise((resolve) => setTimeout(resolve, 50));
        await storeTokenPromise;
      });
      mockFetchUserProfile.mockResolvedValueOnce(mockUser);

      // Act
      const { handleOAuthCallback } = useAuthStore.getState();
      const callbackPromise = handleOAuthCallback(mockToken);

      // Assert - check loading state while processing
      // Wait a bit to ensure the loading state has been set
      await new Promise((resolve) => setTimeout(resolve, 20));
      const loadingState = useAuthStore.getState();
      expect(loadingState.isLoading).toBe(true);

      // Complete the token storage
      storeTokenResolve?.();
      await callbackPromise;

      // Assert - check final state
      const finalState = useAuthStore.getState();
      expect(finalState.isLoading).toBe(false);
      expect(finalState.isAuthenticated).toBe(true);
    });
  });

  describe('initAuth', () => {
    it('should initialize auth state with valid token', async () => {
      // Arrange
      const fixedDate = '2025-11-10T00:00:00.000Z';
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: undefined,
        displayName: 'Test User',
        oauthProvider: 'github' as const,
        oauthId: 'github-123',
        createdAt: fixedDate,
        updatedAt: fixedDate,
      };

      mockIsAuthenticated.mockResolvedValueOnce(true);
      mockFetchUserProfile.mockResolvedValueOnce(mockUser);

      // Act
      const { initAuth } = useAuthStore.getState();
      await initAuth();

      // Assert
      expect(authService.isAuthenticated).toHaveBeenCalled();
      expect(authService.fetchUserProfile).toHaveBeenCalled();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should clean up invalid token on init', async () => {
      // Arrange
      mockIsAuthenticated.mockResolvedValueOnce(true);
      mockFetchUserProfile.mockResolvedValueOnce(null);
      mockSignOut.mockResolvedValueOnce(undefined);

      // Act
      const { initAuth } = useAuthStore.getState();
      await initAuth();

      // Assert
      expect(authService.isAuthenticated).toHaveBeenCalled();
      expect(authService.fetchUserProfile).toHaveBeenCalled();
      expect(authService.signOut).toHaveBeenCalled();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should handle no token on init', async () => {
      // Arrange
      mockIsAuthenticated.mockResolvedValueOnce(false);

      // Act
      const { initAuth } = useAuthStore.getState();
      await initAuth();

      // Assert
      expect(authService.isAuthenticated).toHaveBeenCalled();
      expect(authService.fetchUserProfile).not.toHaveBeenCalled();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('handleOAuthCallbackFromInput', () => {
    it('should accept a deep link URL input', async () => {
      const mockToken = 'valid-jwt-token-123';
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
        displayName: 'Test User',
        oauthProvider: 'github' as const,
        oauthId: 'github-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockStoreAuthToken.mockResolvedValueOnce(undefined);
      mockFetchUserProfile.mockResolvedValueOnce(mockUser);

      const { handleOAuthCallbackFromInput } = useAuthStore.getState();
      const ok = await handleOAuthCallbackFromInput(
        `talkcody://auth/callback?token=${mockToken}`
      );

      expect(ok).toBe(true);
      expect(authService.storeAuthToken).toHaveBeenCalledWith(mockToken);
      expect(toast.success).toHaveBeenCalledWith('Signed in successfully');
    });

    it('should accept a raw token input', async () => {
      const mockToken = 'raw-token-456';
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
        displayName: 'Test User',
        oauthProvider: 'github' as const,
        oauthId: 'github-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockStoreAuthToken.mockResolvedValueOnce(undefined);
      mockFetchUserProfile.mockResolvedValueOnce(mockUser);

      const { handleOAuthCallbackFromInput } = useAuthStore.getState();
      const ok = await handleOAuthCallbackFromInput(mockToken);

      expect(ok).toBe(true);
      expect(authService.storeAuthToken).toHaveBeenCalledWith(mockToken);
      expect(toast.success).toHaveBeenCalledWith('Signed in successfully');
    });

    it('should reject empty input', async () => {
      const { handleOAuthCallbackFromInput } = useAuthStore.getState();
      const ok = await handleOAuthCallbackFromInput('   ');

      expect(ok).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Please paste a valid TalkCody callback link or token.');
      expect(authService.storeAuthToken).not.toHaveBeenCalled();
    });
  });

  describe('loadUserIfNeeded', () => {
    it('should load user when authenticated and user is null', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
        displayName: 'Test User',
        oauthProvider: 'github' as const,
        oauthId: 'github-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAuthStore.setState({
        user: null,
        isAuthenticated: true,
        isLoading: false,
      });

      mockFetchUserProfile.mockResolvedValueOnce(mockUser);

      await useAuthStore.getState().loadUserIfNeeded();

      expect(authService.fetchUserProfile).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('should not load user when not authenticated or already loading', async () => {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });

      await useAuthStore.getState().loadUserIfNeeded();
      expect(authService.fetchUserProfile).not.toHaveBeenCalled();

      useAuthStore.setState({
        user: null,
        isAuthenticated: true,
        isLoading: true,
      });

      await useAuthStore.getState().loadUserIfNeeded();
      expect(authService.fetchUserProfile).not.toHaveBeenCalled();
    });

    it('should not load user when user already exists', async () => {
      useAuthStore.setState({
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          avatarUrl: 'https://example.com/avatar.jpg',
          displayName: 'Test User',
          oauthProvider: 'github',
          oauthId: 'github-123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        isAuthenticated: true,
        isLoading: false,
      });

      await useAuthStore.getState().loadUserIfNeeded();
      expect(authService.fetchUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('Deep Link Integration Test', () => {
    it('should simulate complete deep link OAuth flow', async () => {
      // Arrange - simulate clicking "Sign in with GitHub"
      mockInitiateGitHubOAuth.mockResolvedValueOnce(undefined);

      const { signInWithGitHub } = useAuthStore.getState();
      await signInWithGitHub();

      expect(authService.initiateGitHubOAuth).toHaveBeenCalled();
    });

    it('should initiate Google OAuth flow', async () => {
      mockInitiateGoogleOAuth.mockResolvedValueOnce(undefined);

      const { signInWithGoogle } = useAuthStore.getState();
      await signInWithGoogle();

      expect(authService.initiateGoogleOAuth).toHaveBeenCalled();
    });

    it('should simulate complete deep link OAuth flow with Google', async () => {
      // Arrange - simulate clicking "Sign in with Google"
      mockInitiateGoogleOAuth.mockResolvedValueOnce(undefined);

      const { signInWithGoogle } = useAuthStore.getState();
      await signInWithGoogle();

      expect(authService.initiateGoogleOAuth).toHaveBeenCalled();

      // Simulate OAuth callback from deep link with token
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.abcdef';
      const mockUser = {
        id: 'user-123',
        username: 'googleuser',
        email: 'google@example.com',
        avatarUrl: 'https://google.com/avatar.jpg',
        displayName: 'Google User',
        oauthProvider: 'google' as const,
        oauthId: 'google-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockStoreAuthToken.mockResolvedValueOnce(undefined);
      mockFetchUserProfile.mockResolvedValueOnce(mockUser);

      // Act - handle deep link callback
      const { handleOAuthCallback } = useAuthStore.getState();
      await handleOAuthCallback(mockToken);

      // Assert - verify complete flow
      expect(authService.storeAuthToken).toHaveBeenCalledWith(mockToken);
      expect(authService.fetchUserProfile).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Signed in successfully');

      const finalState = useAuthStore.getState();
      expect(finalState.user).toEqual(mockUser);
      expect(finalState.isAuthenticated).toBe(true);
      expect(finalState.isLoading).toBe(false);
      expect(finalState.error).toBeNull();
    });
  });
});
