import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';

// Mock the Tauri fs and path APIs
const { mockExists, mockMkdir, mockReadDir, mockReadTextFile, mockRemove, mockWriteTextFile } = vi.hoisted(() => ({
  mockExists: vi.fn(),
  mockMkdir: vi.fn(),
  mockReadDir: vi.fn(),
  mockReadTextFile: vi.fn(),
  mockRemove: vi.fn(),
  mockWriteTextFile: vi.fn(),
}));

const { mockJoin } = vi.hoisted(() => ({
  mockJoin: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}));

const { mockGetEffectiveWorkspaceRoot } = vi.hoisted(() => ({
  mockGetEffectiveWorkspaceRoot: vi.fn().mockResolvedValue('/test/root'),
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: mockJoin,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: mockExists,
  mkdir: mockMkdir,
  readDir: mockReadDir,
  readTextFile: mockReadTextFile,
  remove: mockRemove,
  writeTextFile: mockWriteTextFile,
}));

vi.mock('@/services/workspace-root-service', () => ({
  getEffectiveWorkspaceRoot: mockGetEffectiveWorkspaceRoot,
}));


// Import after mocking
import { TaskFileService, taskFileService } from './task-file-service';

describe('TaskFileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton for each test
    (TaskFileService as unknown as { instance: TaskFileService | null }).instance = null;
  });

  describe('singleton pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = TaskFileService.getInstance();
      const instance2 = TaskFileService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('saveOutput', () => {
    it('should save output to correct file path', async () => {
      mockExists.mockResolvedValue(true);
      mockWriteTextFile.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      const result = await service.saveOutput('task-123', 'tool-456', 'test output', 'stdout');

      expect(mockGetEffectiveWorkspaceRoot).toHaveBeenCalledWith('task-123');
      // Verify the final writeTextFile call with correct file path
      const writeCall = mockWriteTextFile.mock.calls[mockWriteTextFile.mock.calls.length - 1];
      expect(writeCall[0]).toContain('tool-456_stdout.log');
      expect(writeCall[1]).toBe('test output');
      expect(result).toContain('/test/root/.talkcody/output/task-123/tool-456_stdout.log');
    });

    it('should reject unsafe suffix', async () => {
      mockExists.mockResolvedValue(true);

      const service = TaskFileService.getInstance();

      await expect(
        service.saveOutput('task-123', 'tool-456', 'test output', '../stdout')
      ).rejects.toThrow('Invalid file name');
    });

    it('should create directory if it does not exist', async () => {
      mockExists.mockResolvedValue(false);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteTextFile.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      await service.saveOutput('task-123', 'tool-456', 'test output');

      expect(mockMkdir).toHaveBeenCalledWith('/test/root/.talkcody/output/task-123', { recursive: true });
    });

    it('should sanitize toolUseId in filename', async () => {
      mockExists.mockResolvedValue(true);
      mockWriteTextFile.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      await service.saveOutput('task-123', '../../../etc/passwd', 'test output');

      const writeCall = mockWriteTextFile.mock.calls[0];
      const filePath = writeCall[0];
      expect(filePath).not.toContain('../');
      expect(filePath).toContain('_');
    });

    it('should sanitize special characters in filename', async () => {
      mockExists.mockResolvedValue(true);
      mockWriteTextFile.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      await service.saveOutput('task-123', 'tool:file|name*test', 'test output');

      const writeCall = mockWriteTextFile.mock.calls[mockWriteTextFile.mock.calls.length - 1];
      const filePath = writeCall[0];
      // Check that sanitized filename doesn't contain special chars
      const fileName = filePath.split('/').pop() || '';
      expect(fileName).not.toMatch(/[<>:"/\\|?*]/);
    });

    it('should save empty content (service does not filter)', async () => {
      // Note: TaskFileService.saveOutput writes content as-is without checking for empty
      // Empty content filtering is done by the caller (bash-executor.processOutput)
      mockExists.mockResolvedValue(true);
      mockWriteTextFile.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      const result = await service.saveOutput('task-123', 'tool-456', '', 'stdout');

      expect(mockWriteTextFile).toHaveBeenCalled();
      expect(result).toContain('.log');
    });

    it('should not truncate content within size limit', async () => {
      mockExists.mockResolvedValue(true);
      mockWriteTextFile.mockResolvedValue(undefined);

      const smallContent = 'test output'; // Much smaller than 50MB

      const service = TaskFileService.getInstance();
      await service.saveOutput('task-123', 'tool-456', smallContent);

      const writeCall = mockWriteTextFile.mock.calls[0];
      expect(writeCall[1]).toBe(smallContent);
    });

    it('should throw error when mkdir fails', async () => {
      mockExists.mockResolvedValue(false);
      mockMkdir.mockRejectedValue(new Error('Permission denied'));

      const service = TaskFileService.getInstance();

      await expect(service.saveOutput('task-123', 'tool-456', 'test'))
        .rejects.toThrow('Failed to create task file directory');
    });

    it('should use default toolUseId when not provided', async () => {
      mockExists.mockResolvedValue(true);
      mockWriteTextFile.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      await service.saveOutput('task-123', '', 'test output');

      const writeCall = mockWriteTextFile.mock.calls[0];
      const filePath = writeCall[0];
      expect(filePath).toContain('unknown.log');
    });
  });

  describe('getOutput', () => {
    it('should read output from correct file path', async () => {
      mockReadTextFile.mockResolvedValue('test content');

      const service = TaskFileService.getInstance();
      const result = await service.getOutput('task-123', 'tool-456', 'stdout');

      expect(mockGetEffectiveWorkspaceRoot).toHaveBeenCalledWith('task-123');
      expect(mockJoin).toHaveBeenCalledWith('/test/root', '.talkcody', 'output', 'task-123', 'tool-456_stdout.log');
      expect(mockReadTextFile).toHaveBeenCalled();
      expect(result).toBe('test content');
    });

    it('should reject unsafe suffix', async () => {
      const service = TaskFileService.getInstance();

      await expect(service.getOutput('task-123', 'tool-456', '../stdout')).rejects.toThrow(
        'Invalid file name'
      );
    });

    it('should return null when file does not exist', async () => {
      const error = new Error('File not found');
      error.name = 'JsError';
      mockReadTextFile.mockRejectedValue(error);

      const service = TaskFileService.getInstance();
      const result = await service.getOutput('task-123', 'tool-456');

      expect(result).toBeNull();
    });

    it('should handle suffix parameter', async () => {
      mockReadTextFile.mockResolvedValue('error content');

      const service = TaskFileService.getInstance();
      await service.getOutput('task-123', 'tool-456', 'error');

      const joinCall = mockJoin.mock.calls[mockJoin.mock.calls.length - 1];
      expect(joinCall[joinCall.length - 1]).toBe('tool-456_error.log');
    });
  });

  describe('removeOutput', () => {
    it('should remove existing output file', async () => {
      mockExists.mockResolvedValue(true);
      mockRemove.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      const result = await service.removeOutput('task-123', 'tool-456', 'stdout');

      expect(mockRemove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should reject unsafe suffix', async () => {
      const service = TaskFileService.getInstance();

      await expect(service.removeOutput('task-123', 'tool-456', '../stdout')).resolves.toBe(false);
    });

    it('should return false when file does not exist', async () => {
      mockExists.mockResolvedValue(false);

      const service = TaskFileService.getInstance();
      const result = await service.removeOutput('task-123', 'tool-456');

      expect(mockRemove).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockExists.mockResolvedValue(true);
      mockRemove.mockRejectedValue(new Error('Permission denied'));

      const service = TaskFileService.getInstance();
      const result = await service.removeOutput('task-123', 'tool-456');

      expect(result).toBe(false);
    });
  });

  describe('writeFile', () => {
    it('should write arbitrary file', async () => {
      mockExists.mockResolvedValue(true);
      mockWriteTextFile.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      const result = await service.writeFile('plan', 'task-123', 'plan.json', '{"test": true}');

      expect(mockWriteTextFile).toHaveBeenCalled();
      expect(result).toContain('.talkcody/plan/task-123/plan.json');
    });

    it('should reject unsafe file names', async () => {
      mockExists.mockResolvedValue(true);

      const service = TaskFileService.getInstance();

      await expect(
        service.writeFile('plan', 'task-123', '../escape.json', '{"test": true}')
      ).rejects.toThrow('Invalid file name');
    });
  });

  describe('readFile', () => {
    it('should read arbitrary file', async () => {
      mockExists.mockResolvedValue(true);
      mockReadTextFile.mockResolvedValue('file content');

      const service = TaskFileService.getInstance();
      const result = await service.readFile('context', 'task-123', 'context.md');

      expect(mockReadTextFile).toHaveBeenCalled();
      expect(result).toBe('file content');
    });

    it('should reject unsafe file names', async () => {
      const service = TaskFileService.getInstance();

      await expect(service.readFile('context', 'task-123', '../secret.txt')).rejects.toThrow(
        'Invalid file name'
      );
    });

    it('should return null when file does not exist', async () => {
      mockExists.mockResolvedValue(false);

      const service = TaskFileService.getInstance();
      const result = await service.readFile('context', 'task-123', 'missing.md');

      expect(mockReadTextFile).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('cleanupTask', () => {
    it('should clean up all file types for a task', async () => {
      // Mock that directories exist
      mockExists.mockImplementation((path: string) => {
        if (path.includes('.talkcody')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
      mockReadDir.mockResolvedValue([{ name: 'file.log' }]);
      mockRemove.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      await service.cleanupTask('task-123');

      // Should clean up output, plan, context, and tool directories
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should skip non-existent directories', async () => {
      mockExists.mockResolvedValue(false);

      const service = TaskFileService.getInstance();
      await service.cleanupTask('task-123');

      // No remove calls should be made if directories don't exist
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });

  describe('cleanupType', () => {
    it('should clean up specific type for a task', async () => {
      mockExists.mockResolvedValue(true);
      mockReadDir.mockResolvedValue([]);
      mockRemove.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      await service.cleanupType('output', 'task-123');

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('sanitizeFileName (private method via saveOutput)', () => {
    it('should handle null/undefined toolUseId', async () => {
      mockExists.mockResolvedValue(true);
      mockWriteTextFile.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      await service.saveOutput('task-123', null as unknown as string, 'test');

      const writeCall = mockWriteTextFile.mock.calls[0];
      expect(writeCall[0]).toContain('unknown.log');
    });

    it('should trim whitespace from filename', async () => {
      mockExists.mockResolvedValue(true);
      mockWriteTextFile.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();
      await service.saveOutput('task-123', '  tool-id  ', 'test');

      const writeCall = mockWriteTextFile.mock.calls[0];
      expect(writeCall[0]).not.toContain('  ');
    });
  });

  describe('directory removal depth limit', () => {
    it('should stop removing at max depth', async () => {
      mockExists.mockResolvedValue(true);
      // Create a chain of nested directories
      mockReadDir.mockResolvedValue([{ name: 'subdir', isDirectory: true }]);
      mockRemove.mockResolvedValue(undefined);

      const service = TaskFileService.getInstance();

      // The service should handle max depth gracefully
      await service.cleanupTask('task-123');

      // Verify that remove was called (for at least some files/dirs)
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});

describe('taskFileService singleton export', () => {
  it('should export a valid singleton instance', () => {
    expect(taskFileService).toBeDefined();
    expect(taskFileService).toBeInstanceOf(TaskFileService);
  });
});
