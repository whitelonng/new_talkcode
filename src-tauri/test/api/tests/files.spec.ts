import { test, expect } from '@playwright/test';
import { createFilePayload } from '../helpers';
import { createSession } from '../helpers';
import { requestBinary, requestJson } from '../helpers';

type UploadFileResponse = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
};

type FileResponse = {
  id: string;
  sessionId: string;
  filename: string;
  mimeType: string;
  size: number;
  origin: string;
};

test('files upload, list, get, download', async () => {
  const sessionId = await createSession();
  const fileData = createFilePayload('api-e2e');

  const uploadResponse = await requestJson<UploadFileResponse>(
    `/v1/sessions/${sessionId}/files`,
    {
      method: 'POST',
      body: fileData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    }
  );
  expect(uploadResponse.status).toBe(200);
  expect(typeof uploadResponse.json?.attachmentId).toBe('string');

  const attachmentId = uploadResponse.json?.attachmentId as string;

  const listResponse = await requestJson<FileResponse[]>(`/v1/sessions/${sessionId}/files`);
  expect(listResponse.status).toBe(200);
  expect(listResponse.json?.length).toBeGreaterThan(0);

  const getResponse = await requestJson<FileResponse>(
    `/v1/sessions/${sessionId}/files/${attachmentId}`
  );
  expect(getResponse.status).toBe(200);
  expect(getResponse.json?.id).toBe(attachmentId);

  const downloadResponse = await requestBinary(
    `/v1/sessions/${sessionId}/files/${attachmentId}/download`
  );
  expect(downloadResponse.status).toBe(200);
  expect(downloadResponse.data.length).toBe(fileData.length);
});
