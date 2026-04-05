import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileExplorerService } from './file-explorer-service';

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(() => Promise.resolve('windows')),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(() => Promise.resolve()),
  revealItemInDir: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('fileExplorerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reveal target path in explorer on Windows', async () => {
    const os = await import('@tauri-apps/plugin-os');
    const opener = await import('@tauri-apps/plugin-opener');

    vi.mocked(os.platform).mockResolvedValue('windows');

    await fileExplorerService.openPath('C:\\repo\\src\\file.ts');

    expect(opener.revealItemInDir).toHaveBeenCalledWith('C:\\repo\\src\\file.ts');
    expect(opener.openPath).not.toHaveBeenCalled();
  });

  it('should open target path directly on non-Windows platforms', async () => {
    const os = await import('@tauri-apps/plugin-os');
    const opener = await import('@tauri-apps/plugin-opener');

    vi.mocked(os.platform).mockResolvedValue('macos');

    await fileExplorerService.openPath('/repo/src/file.ts');

    expect(opener.openPath).toHaveBeenCalledWith('/repo/src/file.ts');
    expect(opener.revealItemInDir).not.toHaveBeenCalled();
  });
});
