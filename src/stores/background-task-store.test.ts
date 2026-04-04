// src/stores/background-task-store.test.ts
// Tests for background task store - specifically for Bug #9 (getter side effects)

import { invoke } from '@tauri-apps/api/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBackgroundTaskStore } from './background-task-store';
import type { BackgroundTask, SpawnBackgroundTaskResponse } from '@/types/background-task';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock logger

describe('BackgroundTaskStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    // Clear all tasks
    useBackgroundTaskStore.setState({ tasks: new Map() });
    vi.clearAllMocks();
  });

  // Helper to create a mock task
  const createMockTask = (overrides: Partial<BackgroundTask> = {}): BackgroundTask => ({
    taskId: 'test-task-1',
    pid: 12345,
    command: 'echo hello',
    status: 'running',
    startTime: Date.now(),
    outputFile: '/tmp/stdout.log',
    errorFile: '/tmp/stderr.log',
    conversationTaskId: 'conv-1',
    toolId: 'tool-1',
    ...overrides,
  });

  // =========================================================================
  // Tests for Bug #9: Getter functions should NOT have side effects
  // =========================================================================

  describe('Getter side effects (Bug #9)', () => {
    it('getAllTasks should not modify state', () => {
      const store = useBackgroundTaskStore.getState();
      const task = createMockTask();

      // Add a task
      store.addTask(task);

      // Get initial state snapshot
      const initialTasks = new Map(useBackgroundTaskStore.getState().tasks);

      // Call getAllTasks multiple times
      const result1 = store.getAllTasks();
      const result2 = store.getAllTasks();
      const result3 = store.getAllTasks();

      // Verify state hasn't changed
      const finalTasks = useBackgroundTaskStore.getState().tasks;
      expect(finalTasks.size).toBe(initialTasks.size);
      expect(finalTasks.get(task.taskId)).toEqual(initialTasks.get(task.taskId));

      // Results should be consistent
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('getTask should not modify state', () => {
      const store = useBackgroundTaskStore.getState();
      const task = createMockTask();

      store.addTask(task);

      const initialTasks = new Map(useBackgroundTaskStore.getState().tasks);

      // Call getTask multiple times
      store.getTask(task.taskId);
      store.getTask(task.taskId);
      store.getTask('non-existent');

      const finalTasks = useBackgroundTaskStore.getState().tasks;
      expect(finalTasks.size).toBe(initialTasks.size);
    });

    it('getRunningTasks should not modify state', () => {
      const store = useBackgroundTaskStore.getState();

      // Add mix of running and completed tasks
      store.addTask(createMockTask({ taskId: 'running-1', status: 'running' }));
      store.addTask(createMockTask({ taskId: 'completed-1', status: 'completed' }));
      store.addTask(createMockTask({ taskId: 'running-2', status: 'running' }));

      const initialTasks = new Map(useBackgroundTaskStore.getState().tasks);

      // Call getRunningTasks multiple times
      const running1 = store.getRunningTasks();
      const running2 = store.getRunningTasks();

      // State should not change
      const finalTasks = useBackgroundTaskStore.getState().tasks;
      expect(finalTasks.size).toBe(initialTasks.size);

      // Should return only running tasks
      expect(running1.length).toBe(2);
      expect(running1).toEqual(running2);
    });

    it('getTasksByConversation should not modify state', () => {
      const store = useBackgroundTaskStore.getState();

      store.addTask(createMockTask({ taskId: 'task-1', conversationTaskId: 'conv-A' }));
      store.addTask(createMockTask({ taskId: 'task-2', conversationTaskId: 'conv-A' }));
      store.addTask(createMockTask({ taskId: 'task-3', conversationTaskId: 'conv-B' }));

      const initialTasks = new Map(useBackgroundTaskStore.getState().tasks);

      // Call getTasksByConversation multiple times
      const convATasks1 = store.getTasksByConversation('conv-A');
      const convATasks2 = store.getTasksByConversation('conv-A');
      store.getTasksByConversation('conv-B');
      store.getTasksByConversation('non-existent');

      const finalTasks = useBackgroundTaskStore.getState().tasks;
      expect(finalTasks.size).toBe(initialTasks.size);

      expect(convATasks1.length).toBe(2);
      expect(convATasks1).toEqual(convATasks2);
    });
  });

  // =========================================================================
  // Tests for basic store operations
  // =========================================================================

  describe('addTask', () => {
    it('should add a task to the store', () => {
      const store = useBackgroundTaskStore.getState();
      const task = createMockTask();

      store.addTask(task);

      expect(store.getTask(task.taskId)).toEqual(task);
      expect(store.getAllTasks().length).toBe(1);
    });

    it('should overwrite existing task with same ID', () => {
      const store = useBackgroundTaskStore.getState();
      const task1 = createMockTask({ status: 'running' });
      const task2 = createMockTask({ status: 'completed' });

      store.addTask(task1);
      store.addTask(task2);

      expect(store.getTask(task1.taskId)?.status).toBe('completed');
      expect(store.getAllTasks().length).toBe(1);
    });
  });

  describe('updateTask', () => {
    it('should update existing task', () => {
      const store = useBackgroundTaskStore.getState();
      const task = createMockTask({ status: 'running' });

      store.addTask(task);
      store.updateTask(task.taskId, { status: 'completed', exitCode: 0 });

      const updated = store.getTask(task.taskId);
      expect(updated?.status).toBe('completed');
      expect(updated?.exitCode).toBe(0);
    });

    it('should not modify store if task does not exist', () => {
      const store = useBackgroundTaskStore.getState();

      store.updateTask('non-existent', { status: 'completed' });

      expect(store.getAllTasks().length).toBe(0);
    });
  });

  describe('removeTask', () => {
    it('should remove task from store', () => {
      const store = useBackgroundTaskStore.getState();
      const task = createMockTask();

      store.addTask(task);
      expect(store.getAllTasks().length).toBe(1);

      store.removeTask(task.taskId);
      expect(store.getAllTasks().length).toBe(0);
      expect(store.getTask(task.taskId)).toBeUndefined();
    });
  });

  describe('getRunningTasks', () => {
    it('should return only running tasks', () => {
      const store = useBackgroundTaskStore.getState();

      store.addTask(createMockTask({ taskId: 'running-1', status: 'running' }));
      store.addTask(createMockTask({ taskId: 'completed-1', status: 'completed' }));
      store.addTask(createMockTask({ taskId: 'running-2', status: 'running' }));
      store.addTask(createMockTask({ taskId: 'failed-1', status: 'failed' }));
      store.addTask(createMockTask({ taskId: 'killed-1', status: 'killed' }));

      const running = store.getRunningTasks();

      expect(running.length).toBe(2);
      expect(running.every((t) => t.status === 'running')).toBe(true);
      expect(running.map((t) => t.taskId).sort()).toEqual(['running-1', 'running-2']);
    });

    it('should return empty array when no running tasks', () => {
      const store = useBackgroundTaskStore.getState();

      store.addTask(createMockTask({ taskId: 'completed-1', status: 'completed' }));
      store.addTask(createMockTask({ taskId: 'failed-1', status: 'failed' }));

      const running = store.getRunningTasks();
      expect(running.length).toBe(0);
    });
  });

  describe('getTasksByConversation', () => {
    it('should filter tasks by conversation ID', () => {
      const store = useBackgroundTaskStore.getState();

      store.addTask(createMockTask({ taskId: 't1', conversationTaskId: 'conv-A' }));
      store.addTask(createMockTask({ taskId: 't2', conversationTaskId: 'conv-A' }));
      store.addTask(createMockTask({ taskId: 't3', conversationTaskId: 'conv-B' }));

      const convATasks = store.getTasksByConversation('conv-A');
      const convBTasks = store.getTasksByConversation('conv-B');
      const convCTasks = store.getTasksByConversation('conv-C');

      expect(convATasks.length).toBe(2);
      expect(convBTasks.length).toBe(1);
      expect(convCTasks.length).toBe(0);
    });
  });

  describe('spawnTask', () => {
    it('should wrap request payload and add task', async () => {
      const store = useBackgroundTaskStore.getState();
      const invokeMock = vi.mocked(invoke);

      const response: SpawnBackgroundTaskResponse = {
        taskId: 'bg-1',
        pid: 4321,
        outputFile: '/tmp/stdout.log',
        errorFile: '/tmp/stderr.log',
        success: true,
      };

      invokeMock.mockResolvedValue(response);

      const taskId = await store.spawnTask('echo hello', 'conv-1', 'tool-1', '/tmp', 1234);

      expect(invokeMock).toHaveBeenCalledWith('spawn_background_task', {
        request: {
          command: 'echo hello',
          cwd: '/tmp',
          maxTimeoutMs: 1234,
        },
      });

      expect(taskId).toBe('bg-1');

      const task = store.getTask('bg-1');
      expect(task).toBeDefined();
      expect(task?.pid).toBe(4321);
      expect(task?.command).toBe('echo hello');
      expect(task?.status).toBe('running');
      expect(task?.outputFile).toBe('/tmp/stdout.log');
      expect(task?.errorFile).toBe('/tmp/stderr.log');
      expect(task?.conversationTaskId).toBe('conv-1');
      expect(task?.toolId).toBe('tool-1');
      expect(task?.maxTimeoutMs).toBe(1234);
      expect(task?.lastOutput).toEqual({ stdoutBytesRead: 0, stderrBytesRead: 0 });
    });

    it('should surface errors when spawn fails', async () => {
      const store = useBackgroundTaskStore.getState();
      const invokeMock = vi.mocked(invoke);

      const response: SpawnBackgroundTaskResponse = {
        taskId: 'bg-2',
        pid: 1,
        outputFile: '/tmp/stdout.log',
        errorFile: '/tmp/stderr.log',
        success: false,
        error: 'Boom',
      };

      invokeMock.mockResolvedValue(response);

      await expect(
        store.spawnTask('echo bad', 'conv-2', 'tool-2')
      ).rejects.toThrow('Boom');
      expect(store.getAllTasks().length).toBe(0);
    });
  });
});
