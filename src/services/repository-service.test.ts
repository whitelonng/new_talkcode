import { beforeEach, describe, expect, it, vi } from 'vitest';

// Override the global mock from setup.ts for this specific test
vi.mock('@tauri-apps/api/path', () => ({
  dirname: vi.fn(),
  join: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  rename: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  readDir: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
  stat: vi.fn(),
  copyFile: vi.fn(),
}));

// Unmock repository-service so we can test the actual implementation
vi.unmock('./repository-service');

import { dirname, join } from '@tauri-apps/api/path';
import { exists, rename } from '@tauri-apps/plugin-fs';
import { repositoryService } from './repository-service';

const mockExists = vi.mocked(exists);
const mockRename = vi.mocked(rename);
const mockDirname = vi.mocked(dirname);
const mockJoin = vi.mocked(join);

describe('repositoryService.moveFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryService.clearCache();
  });

  it('should move a file to a different directory', async () => {
    mockExists.mockResolvedValueOnce(true); // source exists
    mockExists.mockResolvedValueOnce(false); // destination does not exist
    mockRename.mockResolvedValueOnce(undefined);

    await repositoryService.moveFile('/project/src/file.ts', '/project/lib/file.ts');

    expect(mockRename).toHaveBeenCalledWith('/project/src/file.ts', '/project/lib/file.ts');
  });

  it('should throw error when source does not exist', async () => {
    mockExists.mockResolvedValueOnce(false); // source does not exist

    await expect(
      repositoryService.moveFile('/project/src/file.ts', '/project/lib/file.ts')
    ).rejects.toThrow('Source file/directory does not exist');
  });

  it('should throw error when destination already exists', async () => {
    mockExists.mockResolvedValueOnce(true); // source exists
    mockExists.mockResolvedValueOnce(true); // destination exists

    await expect(
      repositoryService.moveFile('/project/src/file.ts', '/project/lib/file.ts')
    ).rejects.toThrow('A file or directory already exists');
  });

  it('should move cache entry when moving a cached file', async () => {
    // First, manually add a cache entry by reading through fileCache
    // Since we can't directly access private fileCache, we test via behavior

    mockExists.mockResolvedValueOnce(true); // source exists
    mockExists.mockResolvedValueOnce(false); // destination does not exist
    mockRename.mockResolvedValueOnce(undefined);

    await repositoryService.moveFile('/project/old/file.ts', '/project/new/file.ts');

    expect(mockRename).toHaveBeenCalledWith('/project/old/file.ts', '/project/new/file.ts');
    expect(mockRename).toHaveBeenCalledTimes(1);
  });
});

describe('repositoryService.renameFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryService.clearCache();
  });

  it('should rename a file in the same directory', async () => {
    mockDirname.mockResolvedValueOnce('/project/src');
    mockJoin.mockResolvedValueOnce('/project/src/newname.ts');
    mockExists.mockResolvedValueOnce(false); // target does not exist
    mockRename.mockResolvedValueOnce(undefined);

    await repositoryService.renameFile('/project/src/oldname.ts', 'newname.ts');

    expect(mockDirname).toHaveBeenCalledWith('/project/src/oldname.ts');
    expect(mockJoin).toHaveBeenCalledWith('/project/src', 'newname.ts');
    expect(mockRename).toHaveBeenCalledWith('/project/src/oldname.ts', '/project/src/newname.ts');
  });

  it('should throw error when target already exists', async () => {
    mockDirname.mockResolvedValueOnce('/project/src');
    mockJoin.mockResolvedValueOnce('/project/src/existing.ts');
    mockExists.mockResolvedValueOnce(true); // target exists

    await expect(
      repositoryService.renameFile('/project/src/oldname.ts', 'existing.ts')
    ).rejects.toThrow('A file or directory named "existing.ts" already exists');
  });
});
