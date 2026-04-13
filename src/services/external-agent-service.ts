import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';
import { parseModelIdentifier } from '@/providers/core/provider-utils';
import type {
  ExternalAgentAvailability,
  ExternalAgentBackend,
  ExternalAgentSessionState,
} from '@/types';
import type { UIMessage } from '@/types/agent';

interface TauriShellResult {
  stdout: string;
  stderr: string;
  code: number;
  signal?: number | null;
  timed_out?: boolean;
  idle_timed_out?: boolean;
  pid?: number;
}

interface CodexJsonEvent {
  type?: string;
  item?: {
    id?: string;
    type?: string;
    text?: string;
    command?: string;
    status?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface StartExternalAgentSessionOptions {
  taskId: string;
  prompt: string;
  cwd?: string;
  model?: string;
  signal: AbortSignal;
  onStatus?: (status: string) => void;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface ExternalAgentRunResult {
  backend: ExternalAgentBackend;
  finalText: string;
  rawOutput: string;
}

/** Idle timeout in milliseconds before tearing down a Codex session. */
const CODEX_IDLE_TIMEOUT_MS = 120_000; // 120 seconds

class ExternalAgentService {
  private sessions = new Map<string, ExternalAgentSessionState>();

  /**
   * Per-task idle timers.
   * The timer starts when a Codex execution finishes (completed or error).
   * If the user sends a new message within CODEX_IDLE_TIMEOUT_MS the timer is
   * cancelled and the session stays warm (status remains 'idle').
   * If the timer fires, the session is torn down.
   * While a Codex command is running the timer is NOT active.
   */
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async getAvailability(): Promise<ExternalAgentAvailability[]> {
    const [codex, claude] = await Promise.all([
      this.checkCommand('codex', 'codex --version', false),
      this.checkCommand('claude', 'claude --version', true),
    ]);

    return [
      {
        backend: 'native',
        available: true,
        reason: 'Built-in TalkCody runtime',
      },
      codex,
      claude,
    ];
  }

  getSession(taskId: string): ExternalAgentSessionState | undefined {
    return this.sessions.get(taskId);
  }

  /**
   * Check whether a warm (idle) session exists for the given task.
   * When `true` the next `runCodexSession` call can skip the cold-start
   * status message and directly execute the command.
   */
  isSessionWarm(taskId: string): boolean {
    const session = this.sessions.get(taskId);
    return session?.status === 'idle';
  }

  /**
   * Explicitly tear down a Codex session and cancel its idle timer.
   */
  destroySession(taskId: string): void {
    this.clearIdleTimer(taskId);
    this.sessions.delete(taskId);
    logger.info('[ExternalAgentService] Session destroyed', { taskId });
  }

  async runCodexSession(options: StartExternalAgentSessionOptions): Promise<ExternalAgentRunResult> {
    const command = this.buildCodexCommand(options.prompt, options.cwd, options.model);

    // Cancel any pending idle timer — the user is active now.
    this.clearIdleTimer(options.taskId);

    const warm = this.isSessionWarm(options.taskId);

    this.sessions.set(options.taskId, {
      taskId: options.taskId,
      backend: 'codex',
      status: 'running',
      rawOutput: '',
      startedAt: Date.now(),
    });

    if (warm) {
      options.onStatus?.('Codex 执行中…');
    } else {
      options.onStatus?.('启动 Codex…');
    }

    try {
      const result = await this.executeCommand(command, options.cwd, options.signal);
      const stdout = result.stdout || '';
      const stderr = result.stderr || '';
      const rawOutput = [stdout, stderr].filter(Boolean).join('\\n');

      if (options.signal.aborted) {
        throw new Error('Codex session aborted');
      }

      if (result.code !== 0) {
        throw new Error(stderr.trim() || stdout.trim() || `Codex exited with code ${result.code}`);
      }

      const finalText = this.consumeCodexJsonl(stdout, options.onStatus, options.onChunk);
      const resolvedText = finalText || stdout.trim();

      options.onComplete?.(resolvedText);

      // Mark session as idle (warm) and start idle countdown.
      this.sessions.set(options.taskId, {
        taskId: options.taskId,
        backend: 'codex',
        status: 'idle',
        rawOutput,
        startedAt: this.sessions.get(options.taskId)?.startedAt,
        endedAt: Date.now(),
      });

      this.startIdleTimer(options.taskId);

      return {
        backend: 'codex',
        finalText: resolvedText,
        rawOutput,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      const finalStatus = options.signal.aborted ? 'stopped' : 'error';
      this.sessions.set(options.taskId, {
        taskId: options.taskId,
        backend: 'codex',
        status: finalStatus,
        rawOutput: this.sessions.get(options.taskId)?.rawOutput ?? '',
        startedAt: this.sessions.get(options.taskId)?.startedAt,
        endedAt: Date.now(),
        error: err.message,
      });

      // Even on error, keep the session warm briefly so the user can retry
      // without a full cold-start message.
      if (finalStatus === 'error') {
        this.sessions.set(options.taskId, {
          ...this.sessions.get(options.taskId)!,
          status: 'idle',
        });
        this.startIdleTimer(options.taskId);
      }

      options.onError?.(err);
      throw err;
    }
  }

  // ─── idle timer helpers ────────────────────────────────────────────────

  private startIdleTimer(taskId: string): void {
    this.clearIdleTimer(taskId);

    const timer = setTimeout(() => {
      this.idleTimers.delete(taskId);
      this.sessions.delete(taskId);
      logger.info('[ExternalAgentService] Codex session timed out after idle', {
        taskId,
        timeoutMs: CODEX_IDLE_TIMEOUT_MS,
      });
    }, CODEX_IDLE_TIMEOUT_MS);

    this.idleTimers.set(taskId, timer);
    logger.info('[ExternalAgentService] Idle timer started', {
      taskId,
      timeoutMs: CODEX_IDLE_TIMEOUT_MS,
    });
  }

  private clearIdleTimer(taskId: string): void {
    const existing = this.idleTimers.get(taskId);
    if (existing) {
      clearTimeout(existing);
      this.idleTimers.delete(taskId);
    }
  }

  // ─── availability check ────────────────────────────────────────────────

  private async checkCommand(
    backend: Extract<ExternalAgentBackend, 'codex' | 'claude'>,
    command: string,
    experimental: boolean
  ): Promise<ExternalAgentAvailability> {
    try {
      const result = await this.executeShell(command, undefined, 15000);
      const version = (result.stdout || result.stderr || '').trim().split(/\\r?\\n/)[0];
      return {
        backend,
        available: result.code === 0,
        version: version || undefined,
        command: backend,
        experimental,
        reason: result.code === 0 ? undefined : `exit code ${result.code}`,
      };
    } catch (error) {
      return {
        backend,
        available: false,
        command: backend,
        experimental,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ─── codex command builder ─────────────────────────────────────────────

  private buildCodexCommand(prompt: string, _cwd?: string, model?: string): string {
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    const parts = ['codex exec --json --skip-git-repo-check'];

    const codexModelName = this.resolveCodexCliModel(model);
    if (codexModelName) {
      parts.push(`-m "${codexModelName.replace(/"/g, '\\"')}"`);
    }

    parts.push(`"${escapedPrompt}"`);
    return parts.join(' ');
  }

  private resolveCodexCliModel(model?: string): string | undefined {
    if (!model) {
      return undefined;
    }

    const { modelKey } = parseModelIdentifier(model);
    const normalized = modelKey.trim().toLowerCase();

    if (!normalized) {
      return undefined;
    }

    if (/^gpt-5(?:\.[123])?-codex(?:-[a-z0-9.]+)?$/.test(normalized)) {
      return modelKey.trim();
    }

    return undefined;
  }

  // ─── shell execution ───────────────────────────────────────────────────

  private async executeCommand(
    command: string,
    cwd: string | undefined,
    signal: AbortSignal
  ): Promise<TauriShellResult> {
    if (signal.aborted) {
      throw new Error('External agent execution aborted');
    }

    return new Promise<TauriShellResult>((resolve, reject) => {
      let settled = false;

      const onAbort = () => {
        if (settled) return;
        settled = true;
        reject(new Error('External agent execution aborted'));
      };

      signal.addEventListener('abort', onAbort, { once: true });

      this.executeShell(command, cwd, 20 * 60 * 1000)
        .then((result) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        })
        .catch((error) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          reject(error);
        });
    });
  }

  private async executeShell(
    command: string,
    cwd: string | undefined,
    timeoutMs: number
  ): Promise<TauriShellResult> {
    logger.info('[ExternalAgentService] execute shell', { command, cwd, timeoutMs });
    return invoke<TauriShellResult>('execute_user_shell', {
      command,
      cwd,
      timeoutMs,
      idleTimeoutMs: timeoutMs,
    });
  }

  // ─── codex JSONL parser ────────────────────────────────────────────────

  private consumeCodexJsonl(
    stdout: string,
    onStatus?: (status: string) => void,
    onChunk?: (chunk: string) => void
  ): string {
    const finalChunks: string[] = [];

    for (const rawEvent of this.extractCodexJsonEvents(stdout)) {
      const trimmed = rawEvent.trim();
      if (!trimmed.startsWith('{')) continue;

      try {
        const event = JSON.parse(trimmed) as CodexJsonEvent;
        const type = event.type ?? event.item?.type;

        if (event.type === 'turn.started') {
          onStatus?.('Codex 正在处理…');
        }

        if (event.type === 'turn.completed') {
          onStatus?.('Codex 已完成');
        }

        if (event.item?.type === 'command_execution' && event.item.command) {
          onStatus?.(`Codex 执行命令: ${event.item.command}`);
        }

        if (event.item?.type === 'agent_message' && event.item.text) {
          finalChunks.push(event.item.text);
          onChunk?.(event.item.text);
        }

        if (type === 'error') {
          onStatus?.('Codex 返回错误');
        }
      } catch {
        // ignore non-json lines
      }
    }

    return finalChunks.join('\\n\\n').trim();
  }

  private extractCodexJsonEvents(stdout: string): string[] {
    const normalized = stdout.replace(/\r/g, '\n');
    const events: string[] = [];
    let index = 0;

    while (index < normalized.length) {
      while (index < normalized.length && /\s/.test(normalized[index] || '')) {
        index += 1;
      }

      if (index >= normalized.length) {
        break;
      }

      if (normalized[index] !== '{') {
        const nextNewline = normalized.indexOf('\n', index);
        if (nextNewline === -1) {
          break;
        }
        index = nextNewline + 1;
        continue;
      }

      let depth = 0;
      let inString = false;
      let escapeNext = false;
      let endIndex = index;

      for (; endIndex < normalized.length; endIndex += 1) {
        const char = normalized[endIndex];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (inString) {
          continue;
        }

        if (char === '{') {
          depth += 1;
        } else if (char === '}') {
          depth -= 1;
          if (depth === 0) {
            events.push(normalized.slice(index, endIndex + 1));
            index = endIndex + 1;
            break;
          }
        }
      }

      if (depth !== 0) {
        break;
      }
    }

    return events;
  }
}

export const externalAgentService = new ExternalAgentService();
