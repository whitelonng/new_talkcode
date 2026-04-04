import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('WindowManagerService.openProjectInWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not focus existing window when suppressFocus is true', async () => {
    const checkSpy = vi
      .spyOn(WindowManagerService, 'checkProjectWindowExists')
      .mockResolvedValue('window-1');
    const focusSpy = vi
      .spyOn(WindowManagerService, 'focusWindow')
      .mockResolvedValue(undefined);
    const createSpy = vi
      .spyOn(WindowManagerService, 'createProjectWindow')
      .mockResolvedValue('window-2');

    const label = await WindowManagerService.openProjectInWindow(
      '/path/to/project',
      'project-1',
      false,
      true
    );

    expect(checkSpy).toHaveBeenCalledWith('/path/to/project');
    expect(focusSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(label).toBe('window-1');
  });

  it('focuses existing window when suppressFocus is false', async () => {
    const checkSpy = vi
      .spyOn(WindowManagerService, 'checkProjectWindowExists')
      .mockResolvedValue('window-3');
    const focusSpy = vi
      .spyOn(WindowManagerService, 'focusWindow')
      .mockResolvedValue(undefined);
    const createSpy = vi
      .spyOn(WindowManagerService, 'createProjectWindow')
      .mockResolvedValue('window-4');

    const label = await WindowManagerService.openProjectInWindow(
      '/path/to/project',
      'project-2',
      false,
      false
    );

    expect(checkSpy).toHaveBeenCalledWith('/path/to/project');
    expect(focusSpy).toHaveBeenCalledWith('window-3');
    expect(createSpy).not.toHaveBeenCalled();
    expect(label).toBe('window-3');
  });
});
