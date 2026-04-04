const DEFAULT_BASE_URL = 'http://localhost:8080';

type ApiMode = 'local' | 'remote';

function parseBaseUrl(baseUrl: string): URL {
  try {
    return new URL(baseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Invalid API_BASE_URL: ${message}`);
  }
}

export function getApiMode(): ApiMode {
  const mode = (process.env.API_E2E_MODE ?? '').toLowerCase();
  if (mode === 'local' || mode === 'remote') {
    return mode;
  }
  if (process.env.API_BASE_URL) {
    return 'remote';
  }
  return 'local';
}

export function getApiBaseUrl(): string {
  const baseUrl = (process.env.API_BASE_URL ?? '').trim();
  if (baseUrl) {
    return parseBaseUrl(baseUrl).toString().replace(/\/$/, '');
  }
  const mode = getApiMode();
  if (mode === 'remote') {
    throw new Error('API_BASE_URL is required when API_E2E_MODE=remote');
  }
  return DEFAULT_BASE_URL;
}

export function isLocalBaseUrl(baseUrl: string): boolean {
  const url = parseBaseUrl(baseUrl);
  const host = url.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
}

export const apiMode = getApiMode();
export const apiBaseUrl = getApiBaseUrl();
export const authToken = (process.env.API_E2E_AUTH_TOKEN ?? '').trim();
export const requireLlm = process.env.API_E2E_REQUIRE_LLM === '1';
export const enableChatStream = process.env.API_E2E_CHAT_STREAM === '1' || requireLlm;

const parsedTimeout = Number.parseInt(process.env.API_E2E_TIMEOUT_MS ?? '', 10);
export const defaultTimeoutMs = Number.isFinite(parsedTimeout) ? parsedTimeout : 15000;
