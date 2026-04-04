// keep-awake-service.test.ts - Unit tests for KeepAwakeService

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeepAwakeService } from './keep-awake-service';

// Mock Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock platform detection
vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock locale
vi.mock('@/locales', () => ({
  getLocale: () => ({
    KeepAwake: {
      enabled: 'Sleep prevented while tasks are running',
      error: 'Failed to prevent system sleep',
      platformNotSupported: 'Sleep prevention not supported on this platform',
    },
  }),
}));

import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { toast } from 'sonner';

describe('KeepAwakeService', () => {
  let service: KeepAwakeService;

  beforeEach(() => {
    service = KeepAwakeService.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    (KeepAwakeService as unknown as { instance: KeepAwakeService | null }).instance = null;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = KeepAwakeService.getInstance();
      const instance2 = KeepAwakeService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('acquire', () => {
    it('should call keep_awake_acquire and return true on first acquire', async () => {
      vi.mocked(invoke).mockResolvedValue(true);
      vi.mocked(platform).mockResolvedValue('macos');
      vi.clearAllMocks();

      const result = await service.acquire();

      expect(invoke).toHaveBeenCalledWith('keep_awake_acquire');
      expect(result).toBe(true);
      expect(toast).not.toHaveBeenCalled();
    });

    it('should return false on subsequent acquire calls', async () => {
      vi.mocked(invoke).mockResolvedValue(false);
      vi.mocked(platform).mockResolvedValue('macos');
      vi.clearAllMocks();

      const result = await service.acquire();

      expect(result).toBe(false);
      expect(toast).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Plugin error'));
      vi.mocked(platform).mockResolvedValue('macos');

      const result = await service.acquire();

      expect(result).toBe(false);
      expect(toast).toHaveBeenCalledWith(
        'Failed to prevent system sleep',
        expect.any(Object)
      );
    });

    it('should not increment refCount when acquire fails', async () => {
      vi.mocked(platform).mockResolvedValue('macos');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'keep_awake_acquire') {
          return Promise.reject(new Error('Plugin error'));
        }
        if (cmd === 'keep_awake_get_ref_count') {
          return Promise.reject(new Error('Plugin error'));
        }
        return Promise.reject(new Error('Unknown command'));
      });

      const result = await service.acquire();
      const refCount = await service.getRefCount();

      expect(result).toBe(false);
      expect(refCount).toBe(0);
    });

    it('should return false for unsupported platforms', async () => {
      vi.mocked(platform).mockResolvedValue('android');
      vi.clearAllMocks();

      const result = await service.acquire();

      expect(result).toBe(false);
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('should call keep_awake_release and return true on last release', async () => {
      vi.mocked(invoke).mockResolvedValue(true);
      vi.mocked(platform).mockResolvedValue('macos');
      vi.clearAllMocks();

      const result = await service.release();

      expect(invoke).toHaveBeenCalledWith('keep_awake_release');
      expect(result).toBe(true);
    });

    it('should return false when other tasks are still active', async () => {
      vi.mocked(invoke).mockResolvedValue(false);
      vi.mocked(platform).mockResolvedValue('macos');
      vi.clearAllMocks();

      const result = await service.release();

      expect(result).toBe(false);
      expect(toast).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Plugin error'));
      vi.mocked(platform).mockResolvedValue('macos');
      vi.clearAllMocks();

      const result = await service.release();

      expect(result).toBe(false);
      expect(toast).toHaveBeenCalledWith(
        'Failed to prevent system sleep',
        expect.any(Object)
      );
    });

    it('should return false for unsupported platforms', async () => {
      vi.mocked(platform).mockResolvedValue('ios');
      vi.clearAllMocks();

      const result = await service.release();

      expect(result).toBe(false);
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('getRefCount', () => {
    it('should return current reference count', async () => {
      vi.mocked(invoke).mockResolvedValue(3);
      vi.mocked(platform).mockResolvedValue('macos');
      vi.clearAllMocks();

      const count = await service.getRefCount();

      expect(invoke).toHaveBeenCalledWith('keep_awake_get_ref_count');
      expect(count).toBe(3);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Plugin error'));
      vi.mocked(platform).mockResolvedValue('macos');

      const count = await service.getRefCount();

      expect(count).toBe(0);
    });
  });

  describe('isPreventingSleep', () => {
    it('should return true when preventing sleep', async () => {
      vi.mocked(invoke).mockResolvedValue(true);
      vi.mocked(platform).mockResolvedValue('macos');

      const preventing = await service.isPreventingSleep();

      expect(invoke).toHaveBeenCalledWith('keep_awake_is_preventing');
      expect(preventing).toBe(true);
    });

    it('should return false when not preventing sleep', async () => {
      vi.mocked(invoke).mockResolvedValue(false);
      vi.mocked(platform).mockResolvedValue('macos');

      const preventing = await service.isPreventingSleep();

      expect(preventing).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Plugin error'));
      vi.mocked(platform).mockResolvedValue('macos');

      const preventing = await service.isPreventingSleep();

      expect(preventing).toBe(false);
    });
  });

  describe('forceReleaseAll', () => {
    it('should release all sleep prevention', async () => {
      vi.mocked(platform).mockResolvedValue('macos');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'keep_awake_get_ref_count') {
          return Promise.resolve(3);
        }
        if (cmd === 'keep_awake_release') {
          return Promise.resolve(false);
        }
        return Promise.reject(new Error('Unknown command'));
      });
      vi.clearAllMocks();

      await service.forceReleaseAll();

      expect(invoke).toHaveBeenCalledWith('keep_awake_get_ref_count');
      expect(invoke).toHaveBeenCalledTimes(4);
    });

    it('should handle zero ref count', async () => {
      vi.mocked(platform).mockResolvedValue('macos');
      vi.mocked(invoke).mockResolvedValue(0);

      await service.forceReleaseAll();

      expect(invoke).toHaveBeenCalledWith('keep_awake_get_ref_count');
      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(platform).mockResolvedValue('macos');
      vi.mocked(invoke).mockRejectedValue(new Error('Plugin error'));

      await expect(service.forceReleaseAll()).resolves.not.toThrow();
    });
  });

  describe('platform detection', () => {
    it('should detect macOS platform', async () => {
      vi.mocked(platform).mockResolvedValue('macos');
      vi.mocked(invoke).mockResolvedValue(true);

      const service = KeepAwakeService.getInstance();
      await service.acquire();

      expect(invoke).toHaveBeenCalledWith('keep_awake_acquire');
    });

    it('should detect Windows platform', async () => {
      vi.mocked(platform).mockResolvedValue('windows');
      vi.mocked(invoke).mockResolvedValue(true);

      const service = KeepAwakeService.getInstance();
      await service.acquire();

      expect(invoke).toHaveBeenCalledWith('keep_awake_acquire');
    });

    it('should detect Linux platform', async () => {
      vi.mocked(platform).mockResolvedValue('linux');
      vi.mocked(invoke).mockResolvedValue(true);

      const service = KeepAwakeService.getInstance();
      await service.acquire();

      expect(invoke).toHaveBeenCalledWith('keep_awake_acquire');
    });
  });
});
