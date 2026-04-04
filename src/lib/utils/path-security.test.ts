// src/lib/utils/path-security.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPathSecurityError, isPathWithinProjectDirectory } from './path-security';

// Mock the Tauri API
vi.mock('@tauri-apps/api/path', () => ({
  normalize: vi.fn((path: string) => Promise.resolve(path)),
}));

describe('path-security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPathWithinProjectDirectory', () => {
    it('should return true for paths within the project directory', async () => {
      const rootPath = '/Users/user/project';
      const targetPath = '/Users/user/project/src/index.ts';

      const result = await isPathWithinProjectDirectory(targetPath, rootPath);
      expect(result).toBe(true);
    });

    it('should return true for the root path itself', async () => {
      const rootPath = '/Users/user/project';
      const targetPath = '/Users/user/project';

      const result = await isPathWithinProjectDirectory(targetPath, rootPath);
      expect(result).toBe(true);
    });

    it('should return false for paths outside the project directory', async () => {
      const rootPath = '/Users/user/project';
      const targetPath = '/Users/user/other-project/src/index.ts';

      const result = await isPathWithinProjectDirectory(targetPath, rootPath);
      expect(result).toBe(false);
    });

    it('should return false for paths that try to escape using ..', async () => {
      const rootPath = '/Users/user/project';
      const targetPath = '/Users/user/project/src/../../../etc/passwd';

      const result = await isPathWithinProjectDirectory(targetPath, rootPath);
      expect(result).toBe(false);
    });

    it('should handle Windows paths correctly', async () => {
      const rootPath = 'C:\\Users\\User\\project';
      const targetPath = 'C:\\Users\\User\\project\\src\\index.ts';

      const result = await isPathWithinProjectDirectory(targetPath, rootPath);
      expect(result).toBe(true);
    });

    it('should return false for Windows paths outside the project directory', async () => {
      const rootPath = 'C:\\Users\\User\\project';
      const targetPath = 'D:\\Other\\project\\src\\index.ts';

      const result = await isPathWithinProjectDirectory(targetPath, rootPath);
      expect(result).toBe(false);
    });
  });

  describe('createPathSecurityError', () => {
    it('should create a descriptive error message', () => {
      const targetPath = '/etc/passwd';
      const allowedRootPath = '/Users/user/project';

      const error = createPathSecurityError(targetPath, allowedRootPath);

      expect(error).toContain('Security Error');
      expect(error).toContain(targetPath);
      expect(error).toContain(allowedRootPath);
      expect(error).toContain('outside the allowed project directory');
    });
  });
});
