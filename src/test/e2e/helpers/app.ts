/**
 * E2E Test Application Helpers
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { selectors } from './selectors';

/**
 * Inject Tauri API mocks into the page before loading
 * This is necessary because TalkCody is a Tauri app and requires Tauri APIs
 */
export async function injectTauriMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Mock __TAURI_INTERNALS__
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: unknown) => {
        console.log('[Mock Tauri] invoke:', cmd, args);
        // Return empty/default values for common commands
        if (cmd === 'plugin:sql|load') return {};
        if (cmd === 'plugin:sql|execute') return { rowsAffected: 1 };
        if (cmd === 'plugin:sql|select') return [];
        if (cmd === 'db_execute') return { rowsAffected: 1 };
        if (cmd === 'db_query') return [];
        if (cmd === 'db_connect') return true;
        return null;
      },
      transformCallback: () => 0,
    };

    // Mock @tauri-apps/api/core invoke
    (window as unknown as Record<string, unknown>).__TAURI__ = {
      core: {
        invoke: async (cmd: string, args?: unknown) => {
          console.log('[Mock Tauri Core] invoke:', cmd, args);
          return null;
        },
      },
    };

    // Pre-populate localStorage with onboarding completed
    try {
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('settings', JSON.stringify({ onboarding_completed: 'true' }));
    } catch (_e) {
      console.log('[Mock] localStorage not available');
    }
  });
}

/**
 * Complete the initial setup wizard if it appears
 */
export async function completeSetupWizard(page: Page): Promise<void> {
  // Wait a moment for the page to stabilize
  await page.waitForTimeout(1000);

  // Try clicking through the wizard steps (up to 10 iterations)
  for (let i = 0; i < 10; i++) {
    // Check if we're still on the wizard (Welcome to TalkCody visible)
    const welcomeVisible = await page
      .getByText('Welcome to TalkCody')
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!welcomeVisible) {
      // Wizard is done
      break;
    }

    // Use evaluate to directly click buttons by text content
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const targetTexts = ['Get Started', 'Next', 'Skip', 'Done'];

      for (const text of targetTexts) {
        const button = buttons.find((b) => b.textContent?.trim() === text);
        if (button) {
          (button as HTMLButtonElement).click();
          return true;
        }
      }
      return false;
    });

    if (!clicked) {
      // No wizard buttons found
      break;
    }

    await page.waitForTimeout(500);
  }
}

/**
 * Wait for app to be ready (chat input visible)
 */
export async function waitForAppReady(page: Page, timeout = 30000): Promise<void> {
  // First, handle setup wizard if present
  await completeSetupWizard(page);

  // Wait for the chat input textarea to be visible
  await page.waitForSelector(selectors.chat.input, { timeout });
}

/**
 * Get the chat input element
 */
export function getChatInput(page: Page): Locator {
  return page.locator(selectors.chat.input);
}

/**
 * Get the send button
 */
export function getSendButton(page: Page): Locator {
  return page.locator(selectors.chat.sendButton);
}

/**
 * Send a chat message by filling input and clicking send
 */
export async function sendMessage(page: Page, message: string): Promise<void> {
  const input = getChatInput(page);
  await input.fill(message);
  await getSendButton(page).click();
}

/**
 * Send a message using Enter key
 */
export async function sendMessageWithEnter(page: Page, message: string): Promise<void> {
  const input = getChatInput(page);
  await input.fill(message);
  await page.keyboard.press('Enter');
}

/**
 * Wait for a message containing specific text to appear
 */
export async function waitForMessage(
  page: Page,
  text: string,
  options: { timeout?: number } = {}
): Promise<Locator> {
  const { timeout = 10000 } = options;
  const message = page.getByText(text, { exact: false });
  await expect(message).toBeVisible({ timeout });
  return message;
}

/**
 * Get all visible text on the page that contains the search text
 */
export async function findTextOnPage(page: Page, text: string): Promise<Locator> {
  return page.getByText(text, { exact: false });
}

/**
 * Get the value of the chat input
 */
export async function getInputValue(page: Page): Promise<string> {
  return getChatInput(page).inputValue();
}

/**
 * Check if input is empty
 */
export async function isInputEmpty(page: Page): Promise<boolean> {
  const value = await getInputValue(page);
  return value.trim() === '';
}

/**
 * Focus the chat input
 */
export async function focusInput(page: Page): Promise<void> {
  await getChatInput(page).focus();
}

/**
 * Type multiline text (using Shift+Enter for newlines)
 */
export async function typeMultilineText(page: Page, lines: string[]): Promise<void> {
  const input = getChatInput(page);
  await input.click();

  for (let i = 0; i < lines.length; i++) {
    await page.keyboard.type(lines[i]);
    if (i < lines.length - 1) {
      await page.keyboard.press('Shift+Enter');
    }
  }
}

/**
 * Generate a unique test message
 */
export function uniqueMessage(prefix = 'Test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Take a screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Count visible elements matching a locator
 */
export async function countElements(locator: Locator): Promise<number> {
  return locator.count();
}
