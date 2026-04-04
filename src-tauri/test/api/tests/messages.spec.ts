import { test, expect } from '@playwright/test';
import { createMessagePayload } from '../helpers';
import { createSession } from '../helpers';
import { requestJson } from '../helpers';

type CreateMessageResponse = {
  messageId: string;
  createdAt: number;
};

type MessageResponse = {
  id: string;
  sessionId: string;
  role: string;
  content: { type: string; text?: string } | string;
  createdAt: number;
  toolCallId: string | null;
  parentId: string | null;
};

test('messages create and list', async () => {
  const sessionId = await createSession();

  const createResponse = await requestJson<CreateMessageResponse>(
    `/v1/sessions/${sessionId}/messages`,
    {
      method: 'POST',
      body: createMessagePayload('api-e2e-message'),
    }
  );
  expect(createResponse.status).toBe(200);
  expect(typeof createResponse.json?.messageId).toBe('string');

  const listResponse = await requestJson<MessageResponse[]>(
    `/v1/sessions/${sessionId}/messages`
  );
  expect(listResponse.status).toBe(200);
  expect(Array.isArray(listResponse.json)).toBe(true);
  expect(listResponse.json?.length).toBeGreaterThan(0);

  const firstMessage = listResponse.json?.[0];
  expect(firstMessage?.sessionId).toBe(sessionId);
});
