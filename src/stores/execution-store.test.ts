// src/stores/execution-store.test.ts
// Tests for execution store - specifically for GitHub Issue #36
// Bug: Interrupted sessions cannot be deleted until switching to another session

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useExecutionStore } from './execution-store';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ExecutionStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    useExecutionStore.setState({ executions: new Map() });
    vi.clearAllMocks();
  });

  const createExecution = (taskId: string) => {
    const store = useExecutionStore.getState();
    const result = store.startExecution(taskId);
    return result;
  };

  // =========================================================================
  // Tests for GitHub Issue #36: Interrupted sessions cannot be deleted
  // =========================================================================

  describe('GitHub Issue #36: Stop execution and cleanup', () => {
    it('should allow cleanup after stopping execution', () => {
      const store = useExecutionStore.getState();
      const taskId = 'task-1';

      // 1. Start execution
      const { success } = createExecution(taskId);
      expect(success).toBe(true);
      expect(store.isRunning(taskId)).toBe(true);

      // 2. Stop execution (user clicks stop button)
      store.stopExecution(taskId);

      // 3. Verify execution is stopped (not running)
      expect(store.isRunning(taskId)).toBe(false);
      const execution = store.getExecution(taskId);
      expect(execution?.status).toBe('stopped');

      // 4. Cleanup execution (called when deleting task)
      store.cleanupExecution(taskId);

      // 5. Verify execution is cleaned up
      expect(store.getExecution(taskId)).toBeUndefined();
    });

    it('should allow cleanup after execution completes normally', () => {
      const store = useExecutionStore.getState();
      const taskId = 'task-2';

      // 1. Start execution
      createExecution(taskId);
      expect(store.isRunning(taskId)).toBe(true);

      // 2. Complete execution normally
      store.completeExecution(taskId);

      // 3. Verify execution is completed (not running)
      expect(store.isRunning(taskId)).toBe(false);
      const execution = store.getExecution(taskId);
      expect(execution?.status).toBe('completed');

      // 4. Cleanup execution
      store.cleanupExecution(taskId);

      // 5. Verify execution is cleaned up
      expect(store.getExecution(taskId)).toBeUndefined();
    });

    it('should allow cleanup after execution errors', () => {
      const store = useExecutionStore.getState();
      const taskId = 'task-3';

      // 1. Start execution
      createExecution(taskId);
      expect(store.isRunning(taskId)).toBe(true);

      // 2. Set error
      store.setError(taskId, 'Something went wrong');

      // 3. Verify execution is in error state (not running)
      expect(store.isRunning(taskId)).toBe(false);
      const execution = store.getExecution(taskId);
      expect(execution?.status).toBe('error');

      // 4. Cleanup execution
      store.cleanupExecution(taskId);

      // 5. Verify execution is cleaned up
      expect(store.getExecution(taskId)).toBeUndefined();
    });

    it('should NOT allow cleanup while execution is running', () => {
      const store = useExecutionStore.getState();
      const taskId = 'task-4';

      // 1. Start execution
      createExecution(taskId);
      expect(store.isRunning(taskId)).toBe(true);

      // 2. Try to cleanup while running
      store.cleanupExecution(taskId);

      // 3. Verify execution is NOT cleaned up (still in store)
      expect(store.getExecution(taskId)).toBeDefined();
      expect(store.isRunning(taskId)).toBe(true);
    });

    it('completeExecution should NOT overwrite stopped status', () => {
      const store = useExecutionStore.getState();
      const taskId = 'task-5';

      // 1. Start execution
      createExecution(taskId);
      expect(store.isRunning(taskId)).toBe(true);

      // 2. Stop execution
      store.stopExecution(taskId);
      expect(store.getExecution(taskId)?.status).toBe('stopped');

      // 3. Try to complete execution (simulating the race condition)
      store.completeExecution(taskId);

      // 4. Status should remain 'stopped', not change to 'completed'
      expect(store.getExecution(taskId)?.status).toBe('stopped');
    });

    it('completeExecution should NOT overwrite error status', () => {
      const store = useExecutionStore.getState();
      const taskId = 'task-6';

      // 1. Start execution
      createExecution(taskId);
      expect(store.isRunning(taskId)).toBe(true);

      // 2. Set error
      store.setError(taskId, 'Test error');
      expect(store.getExecution(taskId)?.status).toBe('error');

      // 3. Try to complete execution
      store.completeExecution(taskId);

      // 4. Status should remain 'error', not change to 'completed'
      expect(store.getExecution(taskId)?.status).toBe('error');
    });

    it('completeExecution SHOULD overwrite running status', () => {
      const store = useExecutionStore.getState();
      const taskId = 'task-7';

      // 1. Start execution
      createExecution(taskId);
      expect(store.isRunning(taskId)).toBe(true);
      expect(store.getExecution(taskId)?.status).toBe('running');

      // 2. Complete execution
      store.completeExecution(taskId);

      // 3. Status should change to 'completed'
      expect(store.getExecution(taskId)?.status).toBe('completed');
      expect(store.isRunning(taskId)).toBe(false);
    });

    it('should handle the full bug scenario: start -> stop -> cleanup', () => {
      const store = useExecutionStore.getState();
      const taskId = 'bug-task';

      // Simulate the bug scenario from GitHub Issue #36:
      // 1. User starts a conversation with AI
      const { success, abortController } = store.startExecution(taskId);
      expect(success).toBe(true);
      expect(abortController).toBeDefined();

      // 2. AI is generating response (streaming)
      store.updateStreamingContent(taskId, 'Hello, ');
      store.updateStreamingContent(taskId, 'world!', true);
      expect(store.getExecution(taskId)?.streamingContent).toBe('Hello, world!');

      // 3. User interrupts/clicks stop during generation
      store.stopExecution(taskId);

      // 4. Verify execution is properly stopped
      expect(store.isRunning(taskId)).toBe(false);
      expect(store.getExecution(taskId)?.status).toBe('stopped');
      expect(store.getExecution(taskId)?.isStreaming).toBe(false);

      // 5. User tries to delete the session
      // This should work without needing to switch sessions
      store.cleanupExecution(taskId);

      // 6. Verify cleanup succeeded
      expect(store.getExecution(taskId)).toBeUndefined();
    });

    it('should handle rapid start-stop-cleanup sequence', () => {
      const store = useExecutionStore.getState();
      const taskId = 'rapid-task';

      // Rapid sequence of operations
      store.startExecution(taskId);
      store.stopExecution(taskId);
      store.cleanupExecution(taskId);

      // Should be fully cleaned up
      expect(store.getExecution(taskId)).toBeUndefined();
      expect(store.isRunning(taskId)).toBe(false);
    });

    it('cleanupExecution should be idempotent', () => {
      const store = useExecutionStore.getState();
      const taskId = 'idempotent-task';

      // Start and stop
      store.startExecution(taskId);
      store.stopExecution(taskId);

      // Cleanup multiple times
      store.cleanupExecution(taskId);
      store.cleanupExecution(taskId);
      store.cleanupExecution(taskId);

      // Should still be cleaned up (no errors)
      expect(store.getExecution(taskId)).toBeUndefined();
    });
  });

  // =========================================================================
  // Tests for basic store operations
  // =========================================================================

  describe('startExecution', () => {
    it('should start a new execution', () => {
      const store = useExecutionStore.getState();
      const taskId = 'new-task';

      const { success, abortController } = store.startExecution(taskId);

      expect(success).toBe(true);
      expect(abortController).toBeDefined();
      expect(store.isRunning(taskId)).toBe(true);

      const execution = store.getExecution(taskId);
      expect(execution?.status).toBe('running');
      expect(execution?.isStreaming).toBe(false);
      expect(execution?.streamingContent).toBe('');
    });

    it('should fail if task is already running', () => {
      const store = useExecutionStore.getState();
      const taskId = 'duplicate-task';

      const first = store.startExecution(taskId);
      expect(first.success).toBe(true);

      const second = store.startExecution(taskId);
      expect(second.success).toBe(false);
      expect(second.error).toContain('already running');
    });

    it('should respect max concurrent limit', () => {
      const store = useExecutionStore.getState();
      const maxConcurrent = store.maxConcurrent;

      // Start max concurrent executions
      for (let i = 0; i < maxConcurrent; i++) {
        const result = store.startExecution(`concurrent-${i}`);
        expect(result.success).toBe(true);
      }

      // Next one should fail
      const exceeded = store.startExecution('exceeded');
      expect(exceeded.success).toBe(false);
      expect(exceeded.error).toContain('Maximum');
    });
  });

  describe('stopExecution', () => {
    it('should abort and mark as stopped', () => {
      const store = useExecutionStore.getState();
      const taskId = 'stop-test';

      const { abortController } = store.startExecution(taskId);
      expect(abortController?.signal.aborted).toBe(false);

      store.stopExecution(taskId);

      expect(abortController?.signal.aborted).toBe(true);
      expect(store.getExecution(taskId)?.status).toBe('stopped');
      expect(store.getExecution(taskId)?.isStreaming).toBe(false);
    });

    it('should handle stopping non-existent execution gracefully', () => {
      const store = useExecutionStore.getState();

      // Should not throw
      expect(() => store.stopExecution('non-existent')).not.toThrow();
    });
  });

  describe('streaming operations', () => {
    it('should update streaming content', () => {
      const store = useExecutionStore.getState();
      const taskId = 'streaming-task';

      store.startExecution(taskId);

      store.updateStreamingContent(taskId, 'Hello');
      expect(store.getExecution(taskId)?.streamingContent).toBe('Hello');
      expect(store.getExecution(taskId)?.isStreaming).toBe(true);

      store.updateStreamingContent(taskId, ' World', true);
      expect(store.getExecution(taskId)?.streamingContent).toBe('Hello World');
    });

    it('should clear streaming content', () => {
      const store = useExecutionStore.getState();
      const taskId = 'clear-task';

      store.startExecution(taskId);
      store.updateStreamingContent(taskId, 'Some content');

      store.clearStreamingContent(taskId);

      expect(store.getExecution(taskId)?.streamingContent).toBe('');
      expect(store.getExecution(taskId)?.isStreaming).toBe(false);
    });
  });

  describe('selectors', () => {
    it('getRunningTaskIds should return only running tasks', () => {
      const store = useExecutionStore.getState();

      store.startExecution('running-1');
      store.startExecution('running-2');
      store.startExecution('running-3');
      store.stopExecution('running-3');

      const runningIds = store.getRunningTaskIds();

      expect(runningIds).toContain('running-1');
      expect(runningIds).toContain('running-2');
      expect(runningIds).not.toContain('running-3');
      expect(runningIds.length).toBe(2);
    });

    it('getRunningCount should return correct count', () => {
      const store = useExecutionStore.getState();

      expect(store.getRunningCount()).toBe(0);

      store.startExecution('count-1');
      expect(store.getRunningCount()).toBe(1);

      store.startExecution('count-2');
      expect(store.getRunningCount()).toBe(2);

      store.stopExecution('count-1');
      expect(store.getRunningCount()).toBe(1);
    });

    it('canStartNew should respect max concurrent', () => {
      const store = useExecutionStore.getState();
      const maxConcurrent = store.maxConcurrent;

      expect(store.canStartNew()).toBe(true);

      for (let i = 0; i < maxConcurrent; i++) {
        store.startExecution(`max-test-${i}`);
      }

      expect(store.canStartNew()).toBe(false);
    });
  });
});
