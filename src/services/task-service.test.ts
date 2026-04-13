import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalAgentBackend, Task } from '@/types';

const mockAddTask = vi.fn();
const mockSetCurrentTaskId = vi.fn();
const mockRemoveTask = vi.fn();
const mockUpdateTaskSettings = vi.fn();
const mockUpdateTask = vi.fn();
const mockSetWorktreeMode = vi.fn();

const mockTaskStoreState = {
  addTask: mockAddTask,
  setCurrentTaskId: mockSetCurrentTaskId,
  removeTask: mockRemoveTask,
  updateTaskSettings: mockUpdateTaskSettings,
  getMessages: vi.fn(),
  setMessages: vi.fn(),
  getTask: vi.fn(),
  setTasks: vi.fn(),
  addTasks: vi.fn(),
  setLoadingTasks: vi.fn(),
  setError: vi.fn(),
  updateTask: mockUpdateTask,
  updateTaskUsage: vi.fn(),
};

const mockSettingsManager = {
  getProject: vi.fn(),
  getAutoApproveEditsGlobal: vi.fn(),
  getAutoApprovePlanGlobal: vi.fn(),
  getAutoCodeReviewGlobal: vi.fn(),
  setAutoApproveEditsGlobal: vi.fn(),
  setAutoApprovePlanGlobal: vi.fn(),
  setAutoCodeReviewGlobal: vi.fn(),
};

const mockDatabaseService = {
  createTask: vi.fn(),
  updateTaskSettings: vi.fn(),
  updateTaskBackend: vi.fn(),
  getTasks: vi.fn(),
  updateTaskTitle: vi.fn(),
  getTaskDetails: vi.fn(),
};

const mockExecutionState = {
  getRunningTaskIds: vi.fn(() => []),
  cleanupExecution: vi.fn(),
};

const mockWorktreeState = {
  acquireForTask: vi.fn(),
  releaseForTask: vi.fn(),
  isTaskUsingWorktree: vi.fn(() => false),
  setWorktreeMode: mockSetWorktreeMode,
};

vi.mock('@/stores/task-store', () => ({
  useTaskStore: {
    getState: () => mockTaskStoreState,
  },
}));

vi.mock('@/stores/settings-store', () => ({
  settingsManager: mockSettingsManager,
  useSettingsStore: {
    getState: vi.fn(() => ({
      getAutoApproveEditsGlobal: vi.fn(() => false),
      getAutoApprovePlanGlobal: vi.fn(() => false),
      getAutoCodeReviewGlobal: vi.fn(() => false),
      setAutoApproveEditsGlobal: vi.fn(),
      setAutoApprovePlanGlobal: vi.fn(),
      setAutoCodeReviewGlobal: vi.fn(),
    })),
  },
}));

vi.mock('@/services/database-service', () => ({
  databaseService: mockDatabaseService,
}));

vi.mock('@/stores/execution-store', () => ({
  useExecutionStore: {
    getState: () => mockExecutionState,
  },
}));

vi.mock('@/stores/worktree-store', () => ({
  useWorktreeStore: {
    getState: () => mockWorktreeState,
  },
}));

vi.mock('@/services/ai/ai-task-title-service', () => ({
  aiTaskTitleService: {
    generateTitle: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'task-123'),
  generateConversationTitle: vi.fn(() => 'Test Title'),
}));

type TaskServiceExports = typeof import('@/services/task-service');

let taskService: TaskServiceExports['taskService'];

describe('TaskService.createTask', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unmock('@/services/task-service');
    ({ taskService } = await import('@/services/task-service'));
    mockSettingsManager.getProject.mockResolvedValue('default');
    mockSettingsManager.getAutoApproveEditsGlobal.mockResolvedValue(false);
    mockSettingsManager.getAutoApprovePlanGlobal.mockResolvedValue(false);
    mockSettingsManager.getAutoCodeReviewGlobal.mockResolvedValue(false);
    mockDatabaseService.createTask.mockResolvedValue('task-123');
    mockDatabaseService.updateTaskBackend.mockResolvedValue(undefined);
  });

  it('applies auto-approve settings when global setting is enabled', async () => {
    mockSettingsManager.getAutoApproveEditsGlobal.mockResolvedValue(true);
    mockSettingsManager.getAutoCodeReviewGlobal.mockResolvedValue(false);

    const updateSpy = vi
      .spyOn(taskService, 'updateTaskSettings')
      .mockResolvedValue(undefined);
    const titleSpy = vi.spyOn(taskService, 'generateAndUpdateTitle').mockResolvedValue(undefined);

    const taskId = await taskService.createTask('Hello world');

    expect(taskId).toBe('task-123');
    expect(mockDatabaseService.createTask).toHaveBeenCalledWith(
      'Test Title',
      'task-123',
      'default',
      undefined,
      'native'
    );

    const createdTask = mockAddTask.mock.calls[0]?.[0] as Task;
    expect(createdTask.request_count).toBe(0);
    expect(createdTask.settings).toBe(JSON.stringify({ autoApproveEdits: true }));
    expect(updateSpy).toHaveBeenCalledWith('task-123', { autoApproveEdits: true });
    expect(titleSpy).toHaveBeenCalledWith('task-123', 'Hello world');
  });

  it('does not apply auto-approve settings when global setting is disabled', async () => {
    const updateSpy = vi
      .spyOn(taskService, 'updateTaskSettings')
      .mockResolvedValue(undefined);
    const titleSpy = vi.spyOn(taskService, 'generateAndUpdateTitle').mockResolvedValue(undefined);

    const taskId = await taskService.createTask('Hello world');

    expect(taskId).toBe('task-123');
    expect(mockDatabaseService.createTask).toHaveBeenCalledWith(
      'Test Title',
      'task-123',
      'default',
      undefined,
      'native'
    );

    const createdTask = mockAddTask.mock.calls[0]?.[0] as Task;
    expect(createdTask.request_count).toBe(0);
    expect(createdTask.settings).toBeUndefined();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(titleSpy).toHaveBeenCalledWith('task-123', 'Hello world');
  });

  it('applies auto-approve plan when global setting is enabled', async () => {
    mockSettingsManager.getAutoApprovePlanGlobal.mockResolvedValue(true);

    const updateSpy = vi
      .spyOn(taskService, 'updateTaskSettings')
      .mockResolvedValue(undefined);
    const titleSpy = vi.spyOn(taskService, 'generateAndUpdateTitle').mockResolvedValue(undefined);

    const taskId = await taskService.createTask('Hello world');

    expect(taskId).toBe('task-123');
    expect(mockDatabaseService.createTask).toHaveBeenCalledWith(
      'Test Title',
      'task-123',
      'default',
      undefined,
      'native'
    );

    const createdTask = mockAddTask.mock.calls[0]?.[0] as Task;
    expect(createdTask.request_count).toBe(0);
    expect(createdTask.settings).toBe(JSON.stringify({ autoApprovePlan: true }));
    expect(updateSpy).toHaveBeenCalledWith('task-123', { autoApprovePlan: true });
    expect(titleSpy).toHaveBeenCalledWith('task-123', 'Hello world');
  });

  it('binds codex backend to new task settings and persistence', async () => {
    const updateSpy = vi
      .spyOn(taskService, 'updateTaskSettings')
      .mockResolvedValue(undefined);
    vi.spyOn(taskService, 'generateAndUpdateTitle').mockResolvedValue(undefined);

    const taskId = await taskService.createTask('Hello world', { backend: 'codex' });

    expect(taskId).toBe('task-123');
    expect(mockSetWorktreeMode).toHaveBeenCalledWith(true);
    expect(mockDatabaseService.createTask).toHaveBeenCalledWith(
      'Test Title',
      'task-123',
      'default',
      undefined,
      'codex'
    );

    const createdTask = mockAddTask.mock.calls[0]?.[0] as Task;
    expect(createdTask.backend).toBe('codex');
    expect(createdTask.settings).toBe(
      JSON.stringify({
        externalAgent: { backend: 'codex', protocol: 'app-server', experimental: false },
      })
    );
    expect(updateSpy).toHaveBeenCalledWith('task-123', {
      externalAgent: { backend: 'codex', protocol: 'app-server', experimental: false },
    });
  });

  it('updates backend and synchronizes task settings', async () => {
    mockTaskStoreState.getTask.mockReturnValue({
      id: 'task-123',
      settings: JSON.stringify({ autoApprovePlan: true }),
    });

    await taskService.updateTaskBackend('task-123', 'codex' as ExternalAgentBackend);

    expect(mockSetWorktreeMode).toHaveBeenCalledWith(true);
    expect(mockUpdateTask).toHaveBeenCalledWith('task-123', { backend: 'codex' });
    expect(mockUpdateTaskSettings).toHaveBeenCalledWith('task-123', {
      autoApprovePlan: true,
      externalAgent: { backend: 'codex', protocol: 'app-server', experimental: false },
    });
    expect(mockDatabaseService.updateTaskBackend).toHaveBeenCalledWith('task-123', 'codex');
    expect(mockDatabaseService.updateTaskSettings).toHaveBeenCalledWith(
      'task-123',
      JSON.stringify({
        autoApprovePlan: true,
        externalAgent: { backend: 'codex', protocol: 'app-server', experimental: false },
      })
    );
  });
});
