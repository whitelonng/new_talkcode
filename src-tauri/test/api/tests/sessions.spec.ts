import { test, expect } from '@playwright/test';
import { requestJson } from '../helpers';
import { createSession } from '../helpers';

type SessionResponse = {
  id: string;
  projectId: string | null;
  title: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
  lastEventId: string | null;
  metadata: unknown | null;
};

test('sessions CRUD and settings', async () => {
  const sessionId = await createSession();

  const getResponse = await requestJson<SessionResponse>(`/v1/sessions/${sessionId}`);
  expect(getResponse.status).toBe(200);
  expect(getResponse.json?.id).toBe(sessionId);

  const listResponse = await requestJson<SessionResponse[]>('/v1/sessions');
  expect(listResponse.status).toBe(200);
  expect(Array.isArray(listResponse.json)).toBe(true);

  const settingsResponse = await requestJson(`/v1/sessions/${sessionId}/settings`);
  expect(settingsResponse.status).toBe(200);

  const updateSettingsResponse = await requestJson(`/v1/sessions/${sessionId}/settings`, {
    method: 'POST',
    body: {
      autoApprovePlan: true,
      customKey: 'custom-value',
    },
  });
  expect(updateSettingsResponse.status).toBe(200);

  const deleteResponse = await requestJson(`/v1/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  expect(deleteResponse.status).toBe(200);
});
