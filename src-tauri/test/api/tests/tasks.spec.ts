import { test, expect } from '@playwright/test';
import { createTaskPayload } from '../helpers';
import { createSession } from '../helpers';
import { requestJson } from '../helpers';

type CreateTaskResponse = {
  taskId: string;
  sessionId: string;
  state: string;
  createdAt: number;
};

type TaskResponse = {
  id: string;
  sessionId: string;
  state: string;
};

test('tasks create, list, get, patch', async () => {
  const sessionId = await createSession();

  const createResponse = await requestJson<CreateTaskResponse>('/v1/tasks', {
    method: 'POST',
    body: createTaskPayload(sessionId),
  });
  expect(createResponse.status).toBe(200);
  expect(createResponse.json?.sessionId).toBe(sessionId);

  const taskId = createResponse.json?.taskId as string;

  const listResponse = await requestJson<TaskResponse[]>('/v1/tasks');
  expect(listResponse.status).toBe(200);
  expect(Array.isArray(listResponse.json)).toBe(true);

  const getResponse = await requestJson<TaskResponse>(`/v1/tasks/${taskId}`);
  expect(getResponse.status).toBe(200);
  expect(getResponse.json?.id).toBe(taskId);

  const patchResponse = await requestJson<TaskResponse>(`/v1/tasks/${taskId}`, {
    method: 'PATCH',
    body: { action: 'cancel' },
  });
  expect(patchResponse.status).toBe(200);

  const getAfterPatch = await requestJson<TaskResponse>(`/v1/tasks/${taskId}`);
  if (getAfterPatch.status === 200) {
    expect(getAfterPatch.json?.id).toBe(taskId);
  }
});
