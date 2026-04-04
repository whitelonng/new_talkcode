import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock additional dependencies that aren't in setup.ts
vi.mock('@/services/notification-service', () => ({
  notificationService: {
    notifyReviewRequired: vi.fn(),
    notifyHooked: vi.fn(),
  },
}));

// Mock taskService - create a proper mock object
vi.mock('@/services/task-service', () => ({
  taskService: {
    getTaskSettings: vi.fn().mockResolvedValue(null),
    updateTaskSettings: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getAutoApproveEditsGlobal: vi.fn(() => false),
  },
}));

// Create a mock store that works both as a hook and with getState()
vi.mock('@/stores/edit-review-store', () => {
  const mockPendingEdits = new Map();

  const mockStoreState = {
    pendingEdits: mockPendingEdits,
    setPendingEdit: vi.fn(),
    getPendingEdit: vi.fn(),
    approveEdit: vi.fn(),
    rejectEdit: vi.fn(),
    allowAllEdit: vi.fn(),
    clearPendingEdit: vi.fn(),
  };

  const mockUseEditReviewStore = vi.fn((selector) => {
    if (selector) {
      return selector(mockStoreState);
    }
    return mockStoreState;
  });

  mockUseEditReviewStore.getState = vi.fn(() => mockStoreState);

  return {
    useEditReviewStore: mockUseEditReviewStore,
    mockStoreState,
  };
});

// Import after mocks
import { writeFile } from './write-file-tool';
import { repositoryService } from '@/services/repository-service';
import { taskService } from '@/services/task-service';
import { notificationService } from '@/services/notification-service';
import { useEditReviewStore } from '@/stores/edit-review-store';
import { settingsManager } from '@/stores/settings-store';

// Context required by execute function
const testContext = { taskId: 'conv-123' };

describe('writeFile tool', () => {
  const mockRepositoryService = repositoryService as any;
  const mockTaskService = taskService as typeof taskService & {
    getTaskSettings: ReturnType<typeof vi.fn>;
    updateTaskSettings: ReturnType<typeof vi.fn>;
  };
  const mockNotificationService = notificationService as any;

  const getMockStoreState = () => {
    const mockStore = vi.mocked(useEditReviewStore);
    return mockStore.getState();
  };

  beforeEach(() => {
    vi.mocked(settingsManager.getAutoApproveEditsGlobal).mockReturnValue(false);

    const state = getMockStoreState();
    state.pendingEdits.clear();
    state.setPendingEdit = vi.fn();
  });

  afterEach(() => {
    // Reset mocks after each test
  });

  describe('basic tool properties', () => {
    it('should have correct name', () => {
      expect(writeFile.name).toBe('writeFile');
    });

    it('should have description', () => {
      expect(writeFile.description).toBeTruthy();
      expect(writeFile.description).toContain('write content to a file');
    });

    it('should have canConcurrent set to false', () => {
      expect(writeFile.canConcurrent).toBe(false);
    });
  });

  describe('input validation', () => {
    it('should validate correct input', () => {
      const validInput = {
        file_path: '/test/file.ts',
        content: 'const value = 1;',
      };
      const result = writeFile.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject missing file_path', () => {
      const invalidInput = {
        content: 'const value = 1;',
      };
      const result = writeFile.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing content', () => {
      const invalidInput = {
        file_path: '/test/file.ts',
      };
      const result = writeFile.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept empty string content', () => {
      const validInput = {
        file_path: '/test/file.ts',
        content: '',
      };
      const result = writeFile.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('content type handling - LLM returns object instead of string', () => {
    /**
     * BUG SCENARIO:
     * LLM incorrectly returns content as an object instead of a string:
     *   content: { name: "test", version: "1.0.0" }
     * instead of:
     *   content: '{"name": "test", "version": "1.0.0"}'
     *
     * This causes "e.replace is not a function" error when normalizeString() is called.
     * The fix stringifies the object before processing.
     */

    beforeEach(() => {
      mockTaskService.getTaskSettings.mockResolvedValue(null);
    });

    it('should handle content as object by stringifying it', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      // Simulate LLM returning content as object
      const result = await writeFile.execute(
        {
          file_path: 'src/package.json',
          content: {
            name: 'test-package',
            version: '1.0.0',
            dependencies: {
              lodash: '^4.0.0',
            },
          } as unknown as string, // Type assertion to simulate LLM error
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      // Verify writeFile was called with stringified content
      expect(mockRepositoryService.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        expect.stringContaining('"name": "test-package"')
      );
    });

    it('should handle deeply nested object content', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const nestedObject = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
        array: [1, 2, { nested: true }],
      };

      const result = await writeFile.execute(
        {
          file_path: 'src/config.json',
          content: nestedObject as unknown as string,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(mockRepositoryService.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.stringContaining('"level1"')
      );
    });

    it('should handle array content by stringifying it', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const arrayContent = ['item1', 'item2', { key: 'value' }];

      const result = await writeFile.execute(
        {
          file_path: 'src/list.json',
          content: arrayContent as unknown as string,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(mockRepositoryService.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('list.json'),
        expect.stringContaining('"item1"')
      );
    });

    it('should NOT stringify content when it is already a string', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const stringContent = '{"name": "test"}';

      const result = await writeFile.execute(
        {
          file_path: 'src/file.json',
          content: stringContent,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(mockRepositoryService.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('file.json'),
        stringContent
      );
    });

    it('should handle the actual bug scenario from error logs', async () => {
      /**
       * ACTUAL BUG FROM LOGS:
       * LLM returned:
       * {
       *   "type": "tool_use",
       *   "name": "writeFile",
       *   "input": {
       *     "file_path": "/Users/kks/mygit/trader/package.json",
       *     "content": {
       *       "name": "trader-option-strategy",
       *       "version": "1.0.0",
       *       ...
       *     }
       *   }
       * }
       */
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const result = await writeFile.execute(
        {
          file_path: 'src/trader/package.json',
          content: {
            name: 'trader-option-strategy',
            version: '1.0.0',
            type: 'module',
            description: 'Option trading strategy agent',
          } as unknown as string,
          review_mode: false,
        },
        testContext
      );

      // Should succeed, not fail with "e.replace is not a function"
      expect(result.success).toBe(true);
      expect(mockRepositoryService.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('trader-option-strategy')
      );
    });

    it('should handle empty object content', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const result = await writeFile.execute(
        {
          file_path: 'src/empty.json',
          content: {} as unknown as string,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(mockRepositoryService.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('empty.json'),
        '{}'
      );
    });

    it('should handle object with special characters in values', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const result = await writeFile.execute(
        {
          file_path: 'src/special.json',
          content: {
            message: 'Hello\nWorld\t!',
            path: 'C:\\Users\\test',
            quote: '"quoted"',
          } as unknown as string,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(mockRepositoryService.writeFile).toHaveBeenCalled();
    });

    it('should preserve JSON formatting with indentation', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const result = await writeFile.execute(
        {
          file_path: 'src/formatted.json',
          content: { key: 'value' } as unknown as string,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      // Check that the content is formatted with indentation (null, 2)
      const writtenContent = mockRepositoryService.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('\n');
      expect(writtenContent).toContain('  '); // 2-space indentation
    });
  });

  describe('path security', () => {
    beforeEach(() => {
      mockTaskService.getTaskSettings.mockResolvedValue(null);
    });

    it('should accept valid path within project directory', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const result = await writeFile.execute(
        {
          file_path: 'src/file.ts',
          content: 'const value = 1;',
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
    });

    it('should reject path outside project directory', async () => {
      const result = await writeFile.execute(
        {
          file_path: '/etc/passwd',
          content: 'malicious content',
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Security');
    });

    it('should reject path traversal attempts', async () => {
      const result = await writeFile.execute(
        {
          file_path: '../../../etc/passwd',
          content: 'malicious content',
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Security');
    });

    it('should handle missing workspace root', async () => {
      const { getEffectiveWorkspaceRoot } = await import('@/services/workspace-root-service');
      const mockGetEffectiveWorkspaceRoot = getEffectiveWorkspaceRoot as any;
      mockGetEffectiveWorkspaceRoot.mockResolvedValueOnce(null);

      const result = await writeFile.execute(
        {
          file_path: 'src/file.ts',
          content: 'const value = 1;',
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Project root path is not set');
    });
  });

  describe('file operations', () => {
    beforeEach(() => {
      mockTaskService.getTaskSettings.mockResolvedValue(null);
    });

    it('should create new file successfully', async () => {
      mockRepositoryService.readFileWithCache.mockRejectedValue(new Error('File not found'));
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const result = await writeFile.execute(
        {
          file_path: 'src/new-file.ts',
          content: 'const value = 1;',
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully wrote to file');
    });

    it('should overwrite existing file successfully', async () => {
      mockRepositoryService.readFileWithCache.mockResolvedValue('old content');
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const result = await writeFile.execute(
        {
          file_path: 'src/existing-file.ts',
          content: 'new content',
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
    });

    it('should handle write file errors', async () => {
      mockRepositoryService.readFileWithCache.mockRejectedValue(new Error('File not found'));
      mockRepositoryService.writeFile.mockRejectedValue(new Error('Permission denied'));

      const result = await writeFile.execute(
        {
          file_path: 'src/file.ts',
          content: 'const value = 1;',
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Permission denied');
    });
  });

  describe('review mode', () => {
    describe('auto-approve', () => {
      it('should auto-approve when enabled in settings', async () => {
        mockRepositoryService.readFileWithCache.mockRejectedValue(new Error('File not found'));
        mockRepositoryService.writeFile.mockResolvedValue(undefined);
        mockTaskService.getTaskSettings.mockResolvedValue(JSON.stringify({ autoApproveEdits: true }));

        const result = await writeFile.execute(
          {
            file_path: 'src/file.ts',
            content: 'const value = 1;',
            review_mode: true,
          },
          testContext
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('Auto-approved');
        expect(mockRepositoryService.writeFile).toHaveBeenCalled();
      });

      it('should auto-approve when global setting is enabled and task settings are missing', async () => {
        mockRepositoryService.readFileWithCache.mockRejectedValue(new Error('File not found'));
        mockRepositoryService.writeFile.mockResolvedValue(undefined);
        mockTaskService.getTaskSettings.mockResolvedValue(null);
        vi.mocked(settingsManager.getAutoApproveEditsGlobal).mockReturnValue(true);

        await writeFile.execute(
          {
            file_path: 'src/file.ts',
            content: 'const value = 1;',
            review_mode: true,
          },
          testContext
        );

        expect(getMockStoreState().setPendingEdit).not.toHaveBeenCalled();
        expect(mockRepositoryService.writeFile).toHaveBeenCalled();
      });
    });

    describe('manual review', () => {
      it('should store pending edit correctly', async () => {
        mockRepositoryService.readFileWithCache.mockRejectedValue(new Error('File not found'));
        mockTaskService.getTaskSettings.mockResolvedValue(null);

        const mockSetPendingEdit = vi.fn();
        getMockStoreState().setPendingEdit = mockSetPendingEdit;

        mockSetPendingEdit.mockImplementation((taskId, editId, pendingEdit, callbacks, resolver) => {
          setTimeout(() => {
            resolver({ success: true, approved: true, message: 'Approved' });
          }, 0);
        });

        await writeFile.execute(
          {
            file_path: 'src/file.ts',
            content: 'const value = 1;',
            review_mode: true,
          },
          testContext
        );

        expect(mockSetPendingEdit).toHaveBeenCalledWith(
          'conv-123',
          expect.any(String),
          expect.objectContaining({
            filePath: expect.stringContaining('file.ts'),
            operation: 'write',
          }),
          expect.objectContaining({
            onApprove: expect.any(Function),
            onReject: expect.any(Function),
            onAllowAll: expect.any(Function),
          }),
          expect.any(Function)
        );
      });

      it('should handle approval successfully', async () => {
        mockRepositoryService.readFileWithCache.mockRejectedValue(new Error('File not found'));
        mockRepositoryService.writeFile.mockResolvedValue(undefined);
        mockTaskService.getTaskSettings.mockResolvedValue(null);

        const mockSetPendingEdit = vi.fn();
        getMockStoreState().setPendingEdit = mockSetPendingEdit;

        mockSetPendingEdit.mockImplementation(async (taskId, editId, pendingEdit, callbacks, resolver) => {
          const approvalResult = await callbacks.onApprove();
          resolver({ success: true, approved: true, message: approvalResult.message });
        });

        const result = await writeFile.execute(
          {
            file_path: 'src/file.ts',
            content: 'const value = 1;',
            review_mode: true,
          },
          testContext
        );

        expect(result.success).toBe(true);
      });

      it('should handle rejection with feedback', async () => {
        mockRepositoryService.readFileWithCache.mockRejectedValue(new Error('File not found'));
        mockTaskService.getTaskSettings.mockResolvedValue(null);

        const mockSetPendingEdit = vi.fn();
        getMockStoreState().setPendingEdit = mockSetPendingEdit;

        mockSetPendingEdit.mockImplementation((taskId, editId, pendingEdit, callbacks, resolver) => {
          resolver({
            success: true,
            approved: false,
            feedback: 'Content is incorrect',
            message: 'Write rejected',
          });
        });

        const result = await writeFile.execute(
          {
            file_path: 'src/file.ts',
            content: 'const value = 1;',
            review_mode: true,
          },
          testContext
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('Write rejected');
        expect(result.feedback).toBe('Content is incorrect');
      });
    });
  });

  describe('string content with special cases', () => {
    beforeEach(() => {
      mockTaskService.getTaskSettings.mockResolvedValue(null);
    });

    it('should handle string with newlines correctly', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const content = 'line1\nline2\nline3';

      const result = await writeFile.execute(
        {
          file_path: 'src/file.txt',
          content,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(mockRepositoryService.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        content
      );
    });

    it('should handle string with CRLF line endings', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const content = 'line1\r\nline2\r\nline3';

      const result = await writeFile.execute(
        {
          file_path: 'src/file.txt',
          content,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      // normalizeString should convert CRLF to LF
      expect(mockRepositoryService.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        'line1\nline2\nline3'
      );
    });

    it('should handle string with unicode characters', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const content = 'Hello 世界! 🚀';

      const result = await writeFile.execute(
        {
          file_path: 'src/unicode.txt',
          content,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(mockRepositoryService.writeFile).toHaveBeenCalledWith(expect.any(String), content);
    });

    it('should handle large string content', async () => {
      mockRepositoryService.writeFile.mockResolvedValue(undefined);

      const content = 'x'.repeat(100000);

      const result = await writeFile.execute(
        {
          file_path: 'src/large.txt',
          content,
          review_mode: false,
        },
        testContext
      );

      expect(result.success).toBe(true);
    });
  });

  describe('React component rendering', () => {
    it('should render renderToolDoing', () => {
      const params = {
        file_path: 'src/file.ts',
        content: 'const value = 1;',
      };
      const component = writeFile.renderToolDoing?.(params, testContext);
      expect(component).toBeTruthy();
      render(component);
      expect(screen.getByText('src/file.ts')).toBeInTheDocument();
    });

    it('should render renderToolResult for success', () => {
      const result = { success: true, message: 'Successfully wrote to file: src/file.ts' };
      const params = {
        file_path: 'src/file.ts',
        content: 'const value = 1;',
      };
      const component = writeFile.renderToolResult?.(result, params);
      expect(component).toBeTruthy();
      render(component);
      expect(screen.getByText('Successfully wrote to file: src/file.ts')).toBeInTheDocument();
    });

    it('should render renderToolResult for failure', () => {
      const result = { success: false, message: 'Failed to write file: Permission denied' };
      const params = {
        file_path: 'src/file.ts',
        content: 'const value = 1;',
      };
      const component = writeFile.renderToolResult?.(result, params);
      expect(component).toBeTruthy();
      render(component);
      expect(screen.getByText('Failed to write file: Permission denied')).toBeInTheDocument();
    });
  });
});
