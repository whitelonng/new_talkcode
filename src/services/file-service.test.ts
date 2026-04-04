import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exists, mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { fileService } from './file-service';

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/test/app-data'),
  join: vi.fn(async (...parts: string[]) => parts.filter(Boolean).join('/')),
}));

const mockExists = vi.mocked(exists);
const mockMkdir = vi.mocked(mkdir);
const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);

describe('FileService.getFilenameFromPath', () => {
  it('should handle Windows paths', () => {
    expect(fileService.getFilenameFromPath('C:\\Users\\dev\\file.ts')).toBe('file.ts');
  });

  it('should handle mixed separators', () => {
    expect(fileService.getFilenameFromPath('C:/Users/dev\\file.ts')).toBe('file.ts');
  });

  it('should handle trailing separators', () => {
    expect(fileService.getFilenameFromPath('C:\\Users\\dev\\repo\\')).toBe('repo');
  });
});

describe('FileService.copyFileToAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not duplicate extensions when creating attachment filename', async () => {
    const sourcePath = '/source/path/image.png';
    const originalFilename = 'image.png';

    const targetPath = await fileService.copyFileToAttachments(sourcePath, originalFilename);

    expect(targetPath).toMatch(/\/test\/app-data\/attachments\/\d+-image\.png$/);
    expect(mockReadFile).toHaveBeenCalledWith(sourcePath);
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should avoid trailing dot for extensionless filenames', async () => {
    const sourcePath = '/source/path/README';
    const originalFilename = 'README';

    const targetPath = await fileService.copyFileToAttachments(sourcePath, originalFilename);

    expect(targetPath).toMatch(/\/test\/app-data\/attachments\/\d+-README$/);
    expect(mockReadFile).toHaveBeenCalledWith(sourcePath);
    expect(mockWriteFile).toHaveBeenCalled();
  });
});
