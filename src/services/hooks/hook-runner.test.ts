import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hookRunner } from '@/services/hooks/hook-runner';

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/app/data'),
  join: vi.fn().mockImplementation(async (...paths: string[]) => paths.join('/')),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn().mockReturnValue('macos'),
}));

vi.mock('@/services/hooks/hook-config-service', () => ({
  hookConfigService: {
    loadConfigs: vi.fn().mockResolvedValue({
      hooks: {
        PreToolUse: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command: 'echo ok' }],
          },
        ],
      },
    }),
  },
}));

vi.mock('@/services/bash-executor', () => ({
  bashExecutor: {
    executeWithTimeout: vi.fn().mockResolvedValue({
      output: '{"decision":"block","reason":"no"}',
      error: '',
      exit_code: 0,
    }),
  },
}));

describe('hookRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks when hook output decision is block', async () => {
    const summary = await hookRunner.runHooks(
      'PreToolUse',
      'bash',
      {
        session_id: 's1',
        cwd: '/workspace',
        permission_mode: 'default',
        hook_event_name: 'PreToolUse',
        tool_name: 'bash',
        tool_input: { command: 'ls' },
        tool_use_id: 'tool-1',
      },
      'task-1'
    );

    expect(summary.blocked).toBe(true);
    expect(summary.blockReason).toBe('no');
  });
});
