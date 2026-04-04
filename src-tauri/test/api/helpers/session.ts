import { expect } from '@playwright/test';
import { requestJson } from './api-client';
import { createSessionPayload } from './fixtures';

type CreateSessionResponse = {
  sessionId: string;
  createdAt: number;
};

type ErrorResponse = {
  error: string;
  message: string;
};

export async function createSession(): Promise<string> {
  const payload = createSessionPayload();
  const response = await requestJson<CreateSessionResponse>('/v1/sessions', {
    method: 'POST',
    body: payload,
  });

  expect(response.status).toBe(200);
  expect(response.json).not.toBeNull();

  const sessionId = response.json?.sessionId;
  expect(typeof sessionId).toBe('string');

  return sessionId as string;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await requestJson('/v1/sessions/' + sessionId, {
    method: 'DELETE',
  });

  if (response.json && typeof response.json === 'object') {
    const error = response.json as ErrorResponse;
    if (error.error) {
      return;
    }
  }
}
