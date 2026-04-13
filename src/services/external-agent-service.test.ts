import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

describe('externalAgentService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through supported codex models to codex exec', async () => {
    mockInvoke.mockResolvedValue({
      stdout: '{"type":"turn.completed"}\\n{"item":{"type":"agent_message","text":"done"}}',
      stderr: '',
      code: 0,
    });

    const { externalAgentService } = await import('./external-agent-service');

    await externalAgentService.runCodexSession({
      taskId: 'task-1',
      prompt: 'fix it',
      cwd: 'D:/repo',
      model: 'gpt-5.3-codex@openai',
      signal: new AbortController().signal,
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'execute_user_shell',
      expect.objectContaining({
        command: 'codex exec --json --skip-git-repo-check -m "gpt-5.3-codex" "fix it"',
        cwd: 'D:/repo',
      })
    );
  });

  it('omits unsupported TalkCody model identifiers when starting codex', async () => {
    mockInvoke.mockResolvedValue({
      stdout: '{"type":"turn.completed"}\\n{"item":{"type":"agent_message","text":"done"}}',
      stderr: '',
      code: 0,
    });

    const { externalAgentService } = await import('./external-agent-service');

    await externalAgentService.runCodexSession({
      taskId: 'task-2',
      prompt: 'fix it',
      cwd: 'D:/repo',
      model: 'gpt-5.4@openai-compatible-codex-404115',
      signal: new AbortController().signal,
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'execute_user_shell',
      expect.objectContaining({
        command: 'codex exec --json --skip-git-repo-check "fix it"',
        cwd: 'D:/repo',
      })
    );
  });

  it('parses adjacent json events so codex assistant messages render in chat', async () => {
    const onChunk = vi.fn();
    const onComplete = vi.fn();

    mockInvoke.mockResolvedValue({
      stdout:
        '{"type":"thread.started","thread_id":"019d82cf"} ' +
        '{"type":"turn.started"} ' +
        '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"我是 Codex，你当前工作区里的编码助手。"}} ' +
        '{"type":"turn.completed"}',
      stderr: '',
      code: 0,
    });

    const { externalAgentService } = await import('./external-agent-service');

    const result = await externalAgentService.runCodexSession({
      taskId: 'task-adjacent-events',
      prompt: 'hello',
      signal: new AbortController().signal,
      onChunk,
      onComplete,
    });

    expect(onChunk).toHaveBeenCalledWith('我是 Codex，你当前工作区里的编码助手。');
    expect(onComplete).toHaveBeenCalledWith('我是 Codex，你当前工作区里的编码助手。');
    expect(result.finalText).toBe('我是 Codex，你当前工作区里的编码助手。');
  });

  it('marks session as idle after completion and starts idle timer', async () => {
    mockInvoke.mockResolvedValue({
      stdout: '{"item":{"type":"agent_message","text":"done"}}',
      stderr: '',
      code: 0,
    });

    const { externalAgentService } = await import('./external-agent-service');

    await externalAgentService.runCodexSession({
      taskId: 'task-idle',
      prompt: 'hello',
      signal: new AbortController().signal,
    });

    // Session should be idle (warm)
    expect(externalAgentService.isSessionWarm('task-idle')).toBe(true);

    // After 120 seconds idle, session should be destroyed
    vi.advanceTimersByTime(120_000);
    expect(externalAgentService.isSessionWarm('task-idle')).toBe(false);
    expect(externalAgentService.getSession('task-idle')).toBeUndefined();
  });

  it('resets idle timer when a new codex call starts within timeout', async () => {
    mockInvoke.mockResolvedValue({
      stdout: '{"item":{"type":"agent_message","text":"ok"}}',
      stderr: '',
      code: 0,
    });

    const { externalAgentService } = await import('./external-agent-service');

    // First call
    await externalAgentService.runCodexSession({
      taskId: 'task-reset',
      prompt: 'first',
      signal: new AbortController().signal,
    });

    expect(externalAgentService.isSessionWarm('task-reset')).toBe(true);

    // Advance 100 seconds (within timeout)
    vi.advanceTimersByTime(100_000);
    expect(externalAgentService.isSessionWarm('task-reset')).toBe(true);

    // Second call resets the timer
    await externalAgentService.runCodexSession({
      taskId: 'task-reset',
      prompt: 'second',
      signal: new AbortController().signal,
    });

    // Advance another 100 seconds — should still be warm (timer was reset)
    vi.advanceTimersByTime(100_000);
    expect(externalAgentService.isSessionWarm('task-reset')).toBe(true);

    // Advance to 120 seconds after second call
    vi.advanceTimersByTime(20_000);
    expect(externalAgentService.isSessionWarm('task-reset')).toBe(false);
  });

  it('destroySession clears the session and timer', async () => {
    mockInvoke.mockResolvedValue({
      stdout: '{"item":{"type":"agent_message","text":"ok"}}',
      stderr: '',
      code: 0,
    });

    const { externalAgentService } = await import('./external-agent-service');

    await externalAgentService.runCodexSession({
      taskId: 'task-destroy',
      prompt: 'test',
      signal: new AbortController().signal,
    });

    expect(externalAgentService.isSessionWarm('task-destroy')).toBe(true);

    externalAgentService.destroySession('task-destroy');

    expect(externalAgentService.isSessionWarm('task-destroy')).toBe(false);
    expect(externalAgentService.getSession('task-destroy')).toBeUndefined();
  });
});
