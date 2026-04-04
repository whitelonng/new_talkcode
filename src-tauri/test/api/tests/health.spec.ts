import { test, expect } from '@playwright/test';
import { requestJson } from '../helpers';

test('GET /health returns OK', async () => {
  const response = await requestJson('/health');
  expect(response.status).toBe(200);
});
