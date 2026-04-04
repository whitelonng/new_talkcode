import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { simpleFetch } from './tauri-fetch';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: number): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString();
}

// Generate a title based on the first user message
export function generateConversationTitle(firstMessage: string): string {
  // Take first 30 characters and add ellipsis if needed
  const title = firstMessage.length > 30 ? `${firstMessage.substring(0, 30)}...` : firstMessage;
  return title;
}

const customAlphabet = (alphabet: string, defaultSize = 10) => {
  return (size = defaultSize) => {
    let id = '';
    // A compact alternative for `for (var i = 0; i < step; i++)`.
    let i = size;
    while (i--) {
      // `| 0` is more compact and faster than `Math.floor()`.
      id += alphabet[(Math.random() * alphabet.length) | 0];
    }
    return id;
  };
};

export const generateId = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
);

interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
}

/**
 * Fetch with timeout using Tauri's simpleFetch to bypass CORS restrictions.
 * Uses AbortSignal.timeout for automatic request cancellation.
 */
export const fetchWithTimeout = async (
  resource: RequestInfo,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> => {
  const { timeout = 10_000, ...fetchOptions } = options;

  const response = await simpleFetch(resource, {
    ...fetchOptions,
    signal: AbortSignal.timeout(timeout),
  });
  return response;
};

export function format(format?: unknown, ...param: unknown[]): string {
  if (typeof format !== 'string') {
    return String(format || '');
  }

  let i = 0;
  const result = format.replace(/%s/g, () => {
    return i < param.length ? String(param[i++]) : '%s';
  });

  return result;
}

/**
 * Decodes HTML entities in a string
 * Handles common entities like &lt;, &gt;, &amp;, &quot;, &#39;
 */
export function decodeHtmlEntities(text: string): string {
  if (typeof text !== 'string') {
    return text;
  }

  const htmlEntities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
  };

  return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
    return htmlEntities[entity] || entity;
  });
}

/**
 * Recursively decodes HTML entities in an object's string values
 */
export function decodeObjectHtmlEntities(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return decodeHtmlEntities(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(decodeObjectHtmlEntities);
  }

  if (obj && typeof obj === 'object') {
    const decoded: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      decoded[key] = decodeObjectHtmlEntities(value);
    }
    return decoded;
  }

  return obj;
}
