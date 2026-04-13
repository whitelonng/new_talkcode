export type ExternalAgentBackend = 'native' | 'codex' | 'claude';

export type ExternalAgentProtocol = 'pty' | 'json-stream' | 'app-server';

export interface ExternalAgentBinding {
  backend: ExternalAgentBackend;
  protocol?: ExternalAgentProtocol;
  experimental?: boolean;
}

export interface ExternalAgentAvailability {
  backend: ExternalAgentBackend;
  available: boolean;
  version?: string;
  command?: string;
  reason?: string;
  experimental?: boolean;
}

export interface ExternalAgentSessionState {
  taskId: string;
  backend: ExternalAgentBackend;
  status: 'idle' | 'running' | 'completed' | 'stopped' | 'error';
  rawOutput: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
}
