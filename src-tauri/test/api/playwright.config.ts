import { defineConfig } from '@playwright/test';
import { apiBaseUrl, apiMode, isLocalBaseUrl } from './helpers/env';

const shouldStartServer = apiMode === 'local' && isLocalBaseUrl(apiBaseUrl);

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: apiBaseUrl,
  },
  webServer: shouldStartServer
    ? {
        command: 'cargo run --bin api_service',
        cwd: '../../',
        port: 8080,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      }
    : undefined,
});
