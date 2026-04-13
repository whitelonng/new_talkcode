import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStartExecution = vi.fn();
const mockCompleteExecution = vi.fn();
const mockIsRunning = vi.fn();
const mockGetRunningTaskIds = vi.fn();
const mockSetIsStreaming = vi.fn();
const mockSetServerStatus = vi.fn();
const mockSetError = vi.fn();
const mockGetTask = vi.fn();
const mockClearRunningTaskUsage = vi.fn();
const mockCreateAssistantMessage = vi.fn();
const mockUpdateStreamingContent = vi.fn();
const mockFinalizeMessage = vi.fn();
const mockNotifyHooked = vi.fn();
const mockGetEffectiveWorkspaceRoot = vi.fn();
const mockRunCodexSession = vi.fn();
const mockAcquireForTask = vi.fn();
const mockIsTaskUsingWorktree = vi.fn();
const mockReleaseForTask = vi.fn();

vi.mock('@/services/agents/llm-service', () => ({
  createLLMService: vi.fn(() => ({ runAgentLoop: vi.fn() })),
}));
vi.mock('@/services/agents/auto-code-review-hook-service', () => ({
  autoCodeReviewHookService: {},
}));
vi.mock('@/services/agents/llm-completion-hooks', () => ({
  completionHookPipeline: { register: vi.fn(), getRegisteredHooks: vi.fn(() => []) },
}));
vi.mock('@/services/agents/ralph-loop-service', () => ({ ralphLoopService: {} }));
vi.mock('@/services/agents/stop-hook-service', () => ({ stopHookService: {} }));
vi.mock('@/services/message-service', () => ({
  messageService: {
    createAssistantMessage: mockCreateAssistantMessage,
    updateStreamingContent: mockUpdateStreamingContent,
    finalizeMessage: mockFinalizeMessage,
    addToolMessage: vi.fn(),
    addAttachment: vi.fn(),
  },
}));
vi.mock('@/services/notification-service', () => ({
  notificationService: { notifyHooked: mockNotifyHooked },
}));
vi.mock('@/services/task-service', () => ({
  taskService: { updateTaskUsage: vi.fn() },
}));
vi.mock('@/services/external-agent-service', () => ({
  externalAgentService: { runCodexSession: mockRunCodexSession },
}));
vi.mock('@/services/workspace-root-service', () => ({
  getEffectiveWorkspaceRoot: mockGetEffectiveWorkspaceRoot,
}));
vi.mock('@/stores/execution-store', () => ({
  useExecutionStore: {
    getState: () => ({
      startExecution: mockStartExecution,
      completeExecution: mockCompleteExecution,
      isRunning: mockIsRunning,
      getRunningTaskIds: mockGetRunningTaskIds,
      setIsStreaming: mockSetIsStreaming,
      setServerStatus: mockSetServerStatus,
      setError: mockSetError,
      stopExecution: vi.fn(),
      canStartNew: vi.fn(),
    }),
  },
}));
vi.mock('@/stores/task-store', () => ({
  useTaskStore: {
    getState: () => ({
      getTask: mockGetTask,
      runningTaskUsage: new Map(),
      flushRunningTaskUsage: vi.fn(),
      clearRunningTaskUsage: mockClearRunningTaskUsage,
      stopStreaming: vi.fn(),
    }),
  },
}));
vi.mock('@/stores/worktree-store', () => ({
  useWorktreeStore: {
    getState: () => ({
      acquireForTask: mockAcquireForTask,
      isTaskUsingWorktree: mockIsTaskUsingWorktree,
      releaseForTask: mockReleaseForTask,
    }),
  },
}));

describe('executionService external cwd resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    mockStartExecution.mockReturnValue({
      success: true,
      abortController: new AbortController(),
      error: undefined,
    });
    mockCompleteExecution.mockReset();
    mockIsRunning.mockReturnValue(true);
    mockGetRunningTaskIds.mockReturnValue([]);
    mockSetIsStreaming.mockReset();
    mockSetServerStatus.mockReset();
    mockSetError.mockReset();
    mockGetTask.mockReturnValue({ backend: 'codex', settings: undefined });
    mockClearRunningTaskUsage.mockReset();
    mockCreateAssistantMessage.mockReturnValue('msg-1');
    mockUpdateStreamingContent.mockReset();
    mockFinalizeMessage.mockResolvedValue(undefined);
    mockNotifyHooked.mockResolvedValue(undefined);
    mockGetEffectiveWorkspaceRoot.mockResolvedValue('D:/vibe/talkcody');
    mockRunCodexSession.mockImplementation(async ({ onComplete }: { onComplete?: (text: string) => void }) => {
      await onComplete?.('done');
      return { backend: 'codex', finalText: 'done', rawOutput: 'done' };
    });
    mockAcquireForTask.mockResolvedValue(null);
    mockIsTaskUsingWorktree.mockReturnValue(false);
    mockReleaseForTask.mockResolvedValue(undefined);
  });

  it('passes project root as cwd for codex even when worktree is not used', async () => {
    const { executionService } = await import('./execution-service');

    await executionService.startExecution({
      taskId: 'task-1',
      messages: [{ id: 'u1', role: 'user', content: 'hello', timestamp: new Date() } as never],
      model: 'gpt-5.4@openai',
      userMessage: 'hello',
    });

    expect(mockGetEffectiveWorkspaceRoot).toHaveBeenCalledWith('task-1');
    expect(mockRunCodexSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: 'D:/vibe/talkcody',
      })
    );
  });

  it('finalizes assistant message with codex stderr text when external execution fails', async () => {
    mockRunCodexSession.mockImplementationOnce(async ({ onError }: { onError?: (error: Error) => Promise<void> | void }) => {
      await onError?.(new Error('文件名、目录名或卷标语法不正确。 (os error 123)'));
      throw new Error('文件名、目录名或卷标语法不正确。 (os error 123)');
    });

    const { executionService } = await import('./execution-service');

    await executionService.startExecution({
      taskId: 'task-1',
      messages: [{ id: 'u1', role: 'user', content: 'hello', timestamp: new Date() } as never],
      model: 'gpt-5.4@openai',
      userMessage: 'hello',
    });

    expect(mockFinalizeMessage).toHaveBeenCalledWith(
      'task-1',
      'msg-1',
      expect.stringContaining('<<<TALKCODY_EXECUTION_ERROR backend="codex"')
    );
    expect(mockFinalizeMessage).toHaveBeenCalledWith(
      'task-1',
      'msg-1',
      expect.stringContaining('文件名、目录名或卷标语法不正确。 (os error 123)')
    );
    expect(mockSetError).toHaveBeenCalledWith(
      'task-1',
      '文件名、目录名或卷标语法不正确。 (os error 123)'
    );
  });
});
