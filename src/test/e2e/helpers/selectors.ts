/**
 * E2E Test Selectors
 * Uses role-based, text-based, and CSS selectors to match actual UI components
 */

export const selectors = {
  // Chat input area - based on actual component structure
  chat: {
    // The textarea for input (aria-label="Search" in ChatInput)
    input: 'textarea[aria-label="Search"]',
    // Submit button - look for the submit button in the form
    sendButton: 'button[type="submit"]',
    // Message list container
    messageContainer: '[class*="CardContent"]',
    // Individual messages - based on MessageItem component
    messageItem: '[class*="message"]',
  },

  // Sidebar
  sidebar: {
    container: '[class*="sidebar"]',
    newChatButton: 'button:has-text("New")',
  },

  // Common elements
  common: {
    loading: '[class*="loading"], [class*="spinner"]',
    button: 'button',
  },
} as const;

/**
 * Get selector with text content
 */
export function withText(baseSelector: string, text: string): string {
  return `${baseSelector}:has-text("${text}")`;
}

/**
 * Get nth element
 */
export function nth(selector: string, n: number): string {
  return `${selector} >> nth=${n}`;
}

/**
 * Escape special characters for text selector
 */
export function escapeText(text: string): string {
  return text.replace(/"/g, '\\"');
}
