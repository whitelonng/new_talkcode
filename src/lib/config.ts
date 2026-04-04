// Application configuration

export const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3000'
  : import.meta.env.VITE_API_URL_PROD || 'https://api.talkcody.com';

/**
 * Get full API endpoint URL
 */
export function getApiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // Remove trailing slash from base URL
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  return `${baseUrl}${normalizedPath}`;
}
