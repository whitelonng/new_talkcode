import { apiBaseUrl, authToken, defaultTimeoutMs } from './env';

export type FetchResult<TJson = unknown> = {
  url: string;
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
  json: TJson | null;
};

export type BinaryResult = {
  url: string;
  status: number;
  ok: boolean;
  headers: Headers;
  data: Uint8Array;
};

type RequestOptions = RequestInit & { timeoutMs?: number };

type RequestJsonOptions = RequestOptions & { body?: unknown };

function buildUrl(path: string): string {
  return new URL(path, apiBaseUrl).toString();
}

function buildHeaders(input?: HeadersInit, extras?: Record<string, string>): Headers {
  const headers = new Headers(input);
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      headers.set(key, value);
    }
  }
  return headers;
}

function parseJson(text: string): unknown | null {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

function resolveSignal(options: RequestOptions): { signal?: AbortSignal; cleanup: () => void } {
  if (options.signal) {
    return { signal: options.signal, cleanup: () => {} };
  }
  return createTimeoutSignal(options.timeoutMs ?? defaultTimeoutMs);
}

function isBinaryBody(body: unknown): body is ArrayBuffer | Uint8Array {
  return body instanceof ArrayBuffer || body instanceof Uint8Array;
}

export async function requestText(path: string, options: RequestOptions = {}): Promise<FetchResult> {
  const url = buildUrl(path);
  const { signal, cleanup } = resolveSignal(options);
  const response = await fetch(url, { ...options, signal, headers: buildHeaders(options.headers) });
  cleanup();
  const text = await response.text();
  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    text,
    json: parseJson(text),
  };
}

export async function requestJson<TJson = unknown>(
  path: string,
  options: RequestJsonOptions = {}
): Promise<FetchResult<TJson>> {
  const url = buildUrl(path);
  const { signal, cleanup } = resolveSignal(options);

  let body: BodyInit | undefined = undefined;
  let jsonHeaders: Record<string, string> | undefined = undefined;

  if (options.body !== undefined) {
    if (typeof options.body === 'string' || isBinaryBody(options.body)) {
      body = options.body as BodyInit;
    } else {
      body = JSON.stringify(options.body);
      jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
    }
  }

  const response = await fetch(url, {
    ...options,
    body,
    signal,
    headers: buildHeaders(options.headers, jsonHeaders),
  });
  cleanup();

  const text = await response.text();
  const json = parseJson(text) as TJson | null;

  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    text,
    json,
  };
}

export async function requestBinary(
  path: string,
  options: RequestOptions = {}
): Promise<BinaryResult> {
  const url = buildUrl(path);
  const { signal, cleanup } = resolveSignal(options);
  const response = await fetch(url, { ...options, signal, headers: buildHeaders(options.headers) });
  cleanup();

  const data = new Uint8Array(await response.arrayBuffer());

  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    data,
  };
}
