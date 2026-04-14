export interface ExternalAgentErrorPayload {
  backend: string;
  message: string;
}

const PREFIX = '<<<TALKCODY_EXECUTION_ERROR';
const SUFFIX = '>>>';

export function formatExternalAgentErrorContent(payload: ExternalAgentErrorPayload): string {
  const backend = payload.backend.trim().toLowerCase() || 'external-agent';
  const message = payload.message.trim();
  return `${PREFIX} backend="${backend}"\n${message}\n${SUFFIX}`;
}

export function parseExternalAgentErrorContent(content: string): ExternalAgentErrorPayload | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith(PREFIX) || !trimmed.endsWith(SUFFIX)) {
    return null;
  }

  const firstLineEnd = trimmed.indexOf('\n');
  if (firstLineEnd === -1) {
    return null;
  }

  const header = trimmed.slice(0, firstLineEnd);
  const body = trimmed.slice(firstLineEnd + 1, trimmed.length - SUFFIX.length).trim();
  const backendMatch = header.match(/backend="([^"]+)"/i);

  return {
    backend: backendMatch?.[1]?.trim() || 'external-agent',
    message: body,
  };
}
