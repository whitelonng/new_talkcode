import type { User } from '@talkcody/shared';
import { toast } from 'sonner';
import { create } from 'zustand';
import { logger } from '@/lib/logger';
import { getLocale, type SupportedLocale } from '@/locales';
import { authService } from '@/services/auth-service';
import { useSettingsStore } from '@/stores/settings-store';

function getTranslations() {
  const language = (useSettingsStore.getState().language || 'en') as SupportedLocale;
  return getLocale(language);
}

function parseOAuthTokenFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('talkcody://')) {
    try {
      const parsedUrl = new URL(trimmed);
      return parsedUrl.searchParams.get('token')?.trim() || null;
    } catch (error) {
      logger.error('[Auth Store] Failed to parse deep link input:', error);
      return null;
    }
  }

  if (trimmed.includes('token=')) {
    try {
      const parsedUrl = new URL(trimmed);
      const token = parsedUrl.searchParams.get('token')?.trim();
      if (token) {
        return token;
      }
    } catch (error) {
      logger.error('[Auth Store] Failed to parse callback URL input:', error);
    }
  }

  return trimmed;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthStore extends AuthState {
  signInWithGitHub: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  handleOAuthCallback: (token: string) => Promise<void>;
  handleOAuthCallbackFromInput: (input: string) => Promise<boolean>;
  loadUser: () => Promise<void>;
  initAuth: () => Promise<void>;
  initAuthFast: () => Promise<void>;
  loadUserIfNeeded: () => Promise<void>;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  /**
   * Sign in with GitHub
   * Opens system browser for OAuth flow
   */
  signInWithGitHub: async () => {
    try {
      set({ isLoading: true, error: null });
      await authService.initiateGitHubOAuth();
      // OAuth flow continues in browser and returns via deep link
      set({ isLoading: false });
    } catch (error) {
      const t = getTranslations();
      const errorMessage = (error as Error).message;
      set({ error: errorMessage, isLoading: false });
      toast.error(t.Auth.errors.failedToInitiate(errorMessage));
    }
  },

  /**
   * Sign in with Google
   * Opens system browser for OAuth flow
   */
  signInWithGoogle: async () => {
    try {
      set({ isLoading: true, error: null });
      await authService.initiateGoogleOAuth();
      // OAuth flow continues in browser and returns via deep link
      set({ isLoading: false });
    } catch (error) {
      const t = getTranslations();
      const errorMessage = (error as Error).message;
      set({ error: errorMessage, isLoading: false });
      toast.error(t.Auth.errors.failedToInitiate(errorMessage));
    }
  },

  /**
   * Sign out user
   * Removes auth token and clears user state
   */
  signOut: async () => {
    const t = getTranslations();
    try {
      await authService.signOut();
      set({
        user: null,
        isAuthenticated: false,
        error: null,
      });
      toast.success(t.Auth.success.signedOut);
    } catch (error) {
      const errorMessage = (error as Error).message;
      set({ error: errorMessage });
      toast.error(t.Auth.errors.signOutFailed(errorMessage));
    }
  },

  /**
   * Handle OAuth callback with token
   * Called when deep link is received after OAuth flow
   */
  handleOAuthCallback: async (token: string) => {
    const t = getTranslations();
    try {
      logger.info('[Auth Store] handleOAuthCallback called with token length:', token.length);
      set({ isLoading: true, error: null });

      // Store the token securely
      logger.info('[Auth Store] Storing auth token...');
      await authService.storeAuthToken(token);
      logger.info('[Auth Store] Auth token stored successfully');

      // Fetch user profile
      logger.info('[Auth Store] Fetching user profile...');
      const user = await authService.fetchUserProfile();
      logger.info(
        '[Auth Store] User profile fetched:',
        user ? `${user.name} (${user.email})` : 'null'
      );

      if (user) {
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        logger.info('[Auth Store] Auth state updated - user authenticated');
        toast.success(t.Auth.success.signedIn);
      } else {
        logger.error('[Auth Store] Failed to fetch user profile - user is null');
        set({
          error: 'Failed to fetch user profile',
          isLoading: false,
        });
        toast.error(t.Auth.errors.completionFailed);
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error('[Auth Store] OAuth callback error:', errorMessage, error);
      set({
        error: errorMessage,
        isLoading: false,
      });
      toast.error(t.Auth.errors.completionFailedWithMessage(errorMessage));
    }
  },

  /**
   * Handle OAuth callback from manual input (URL or token)
   */
  handleOAuthCallbackFromInput: async (input: string) => {
    const t = getTranslations();
    const token = parseOAuthTokenFromInput(input);
    if (!token) {
      const errorMessage = t.Auth.errors.invalidCallback;
      set({ error: errorMessage });
      toast.error(errorMessage);
      return false;
    }

    await get().handleOAuthCallback(token);
    return true;
  },

  /**
   * Load user profile from API
   * Used to refresh user data
   */
  loadUser: async () => {
    try {
      set({ isLoading: true, error: null });

      const user = await authService.fetchUserProfile();

      if (user) {
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  /**
   * Initialize auth state on app start
   * Checks if token exists and loads user profile
   * @deprecated Use initAuthFast for faster startup
   */
  initAuth: async () => {
    try {
      const isAuthenticated = await authService.isAuthenticated();

      if (isAuthenticated) {
        const user = await authService.fetchUserProfile();

        if (user) {
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          // Token exists but is invalid - clean up
          await authService.signOut();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error('Failed to initialize auth:', errorMessage);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  /**
   * Fast auth initialization - only checks token existence, no network request
   * User profile is loaded lazily when needed via loadUserIfNeeded()
   */
  initAuthFast: async () => {
    try {
      const hasToken = await authService.isAuthenticated();

      if (hasToken) {
        // Mark as authenticated based on token existence
        // User profile will be loaded lazily when needed
        set({
          isAuthenticated: true,
          isLoading: false,
        });
        logger.info('[Auth Store] Fast init: token found, user will be loaded lazily');
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
        logger.info('[Auth Store] Fast init: no token found');
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error('Failed to initialize auth (fast):', errorMessage);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  /**
   * Load user profile if authenticated but user data is not loaded yet
   * Call this when user info is needed (e.g., account settings, share features)
   */
  loadUserIfNeeded: async () => {
    const { isAuthenticated, user, isLoading } = get();

    // Skip if not authenticated, already have user, or currently loading
    if (!isAuthenticated || user || isLoading) {
      return;
    }

    logger.info('[Auth Store] Loading user profile (lazy load)...');
    await get().loadUser();
  },

  /**
   * Update user profile in store
   * Used after profile updates
   */
  updateUser: (user: User) => {
    set({ user });
  },
}));
