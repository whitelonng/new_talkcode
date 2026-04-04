export function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSessionPayload() {
  return {
    projectId: 'api-e2e',
    title: `API E2E ${randomId('session')}`,
  };
}

export function createMessagePayload(content: string) {
  return {
    content,
    role: 'user',
  };
}

export function createTaskPayload(sessionId?: string) {
  return {
    sessionId,
    projectId: 'api-e2e',
    initialMessage: 'API e2e task ping',
  };
}

export function createFilePayload(text = 'api-e2e-file') {
  return new TextEncoder().encode(text);
}
