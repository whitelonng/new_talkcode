import { apiBaseUrl, authToken, defaultTimeoutMs } from './env';

type RequestOptions = RequestInit & { timeoutMs?: number };

export async function fetchSseHeaders(
  path: string,
  options: RequestOptions = {}
): Promise<{ status: number; contentType: string | null; url: string }> {
  const url = new URL(path, apiBaseUrl).toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);

  const headers = new Headers(options.headers);
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  await response.body?.cancel();

  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    url,
  };
}
