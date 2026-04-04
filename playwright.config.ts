import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration
 * Optimized for Tauri desktop application
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './src/test/e2e',

  // Test file matching pattern
  testMatch: '**/*.spec.ts',

  // Global timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Tauri app needs to run serially
  fullyParallel: false,
  workers: 1,

  // Retries in CI environment
  retries: process.env.CI ? 2 : 0,

  // Forbid .only in CI
  forbidOnly: !!process.env.CI,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],

  // Global settings
  use: {
    // Base URL (Vite dev server when running with dev:tauri)
    baseURL: 'http://localhost:1421',

    // Trace configuration
    trace: 'on-first-retry',

    // Screenshot configuration
    screenshot: 'only-on-failure',

    // Video recording
    video: 'on-first-retry',

    // Action timeout
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Project configuration
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Dev server configuration
  // Note: When running manually, start with `bun run dev:tauri` first
  // The webServer config is for CI or when you want Playwright to start the server
  webServer: {
    command: 'bun run dev --port 1421',
    port: 1421,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Output directory
  outputDir: 'test-results/e2e',
});
