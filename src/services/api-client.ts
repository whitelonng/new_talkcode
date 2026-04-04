import { getApiUrl } from '@/lib/config';
import { simpleFetch } from '@/lib/tauri-fetch';
import { getLocale, type SupportedLocale } from '@/locales';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { secureStorage } from './secure-storage';

function getTranslations() {
  const language = (useSettingsStore.getState().language || 'en') as SupportedLocale;
  return getLocale(language);
}

export interface ApiClientOptions extends RequestInit {
  requireAuth?: boolean;
}

class ApiClient {
  /**
   * Make authenticated API request
   * Automatically injects auth token from secure storage
   */
  async fetch(endpoint: string, options: ApiClientOptions = {}): Promise<Response> {
    const { requireAuth = false, ...fetchOptions } = options;

    // Get auth token from secure storage
    const token = await secureStorage.getAuthToken();

    // If auth is required but no token exists, throw error
    if (requireAuth && !token) {
      throw new Error(getTranslations().ApiClient.errors.authenticationRequired);
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Merge with fetchOptions headers
    if (fetchOptions.headers) {
      Object.assign(headers, fetchOptions.headers);
    }

    // Make request
    const url = getApiUrl(endpoint);
    const response = await simpleFetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle 401 Unauthorized - token is invalid/expired
    if (response.status === 401 && token) {
      // Sign out user and clear auth state
      const signOut = useAuthStore.getState().signOut;
      await signOut();
      throw new Error(getTranslations().ApiClient.errors.sessionExpired);
    }

    return response;
  }

  /**
   * GET request
   */
  async get(endpoint: string, options: ApiClientOptions = {}): Promise<Response> {
    return this.fetch(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post(endpoint: string, body?: unknown, options: ApiClientOptions = {}): Promise<Response> {
    return this.fetch(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put(endpoint: string, body?: unknown, options: ApiClientOptions = {}): Promise<Response> {
    return this.fetch(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch(endpoint: string, body?: unknown, options: ApiClientOptions = {}): Promise<Response> {
    return this.fetch(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint: string, options: ApiClientOptions = {}): Promise<Response> {
    return this.fetch(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
