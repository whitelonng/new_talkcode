import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hookConfigService } from '@/services/hooks/hook-config-service';

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/app/data'),
  dirname: vi.fn().mockImplementation(async (value: string) => {
    const parts = value.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }),
  homeDir: vi.fn().mockResolvedValue('/home/user'),
  join: vi.fn().mockImplementation(async (...paths: string[]) => paths.join('/')),
  normalize: vi.fn().mockImplementation(async (value: string) => value),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readTextFile: vi.fn().mockResolvedValue('{"hooks":{}}'),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/workspace-root-service', () => ({
  getValidatedWorkspaceRoot: vi.fn().mockResolvedValue('/workspace'),
}));

describe('HookConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges user and project configs in order', async () => {
    const fs = await import('@tauri-apps/plugin-fs');
    const readTextFile = vi.mocked(fs.readTextFile);

    readTextFile
      .mockResolvedValueOnce(
        JSON.stringify({
          hooks: {
            PreToolUse: [
              { matcher: 'bash', hooks: [{ type: 'command', command: 'echo user' }] },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          hooks: {
            PreToolUse: [
              { matcher: 'readFile', hooks: [{ type: 'command', command: 'echo project' }] },
            ],
          },
        })
      );

    const result = await hookConfigService.loadConfigs();

    expect(result.hooks?.PreToolUse?.length).toBe(2);
    expect(result.hooks?.PostToolUse).toBeUndefined();
  });
});
