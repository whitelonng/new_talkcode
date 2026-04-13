import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { WindowManagerService } from './window-manager-service';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('WindowManagerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets current window label from backend', async () => {
    vi.mocked(invoke).mockResolvedValue('main');

    const label = await WindowManagerService.getCurrentWindowLabel();

    expect(invoke).toHaveBeenCalledWith('get_current_window_label');
    expect(label).toBe('main');
  });

  it('updates window project metadata through backend', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await WindowManagerService.updateWindowProject('main', 'project-1', '/repo');

    expect(invoke).toHaveBeenCalledWith('update_window_project', {
      label: 'main',
      projectId: 'project-1',
      rootPath: '/repo',
    });
  });
});
