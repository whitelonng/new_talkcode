// Utility functions

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a unique slug by appending a counter if needed
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Parse comma-separated tags from query string
 */
export function parseTagsFromQuery(tagsString?: string): string[] {
  if (!tagsString) return [];
  return tagsString
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Get device ID from request headers
 */
export function getDeviceId(headers: Headers): string | undefined {
  return headers.get('X-Device-ID') || undefined;
}
