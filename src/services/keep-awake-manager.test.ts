// keep-awake-manager.test.ts - Unit tests for keep-awake manager

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keepAwakeManager } from './keep-awake-manager';
import { keepAwakeService } from './keep-awake-service';
import { useExecutionStore } from '@/stores/execution-store';

vi.mock('./keep-awake-service', () => ({
  keepAwakeService: {
    acquire: vi.fn(),
    release: vi.fn(),
    getRefCount: vi.fn(),
  },
}));

const { executionState, listeners, mockExecutionStore } = vi.hoisted(() => {
  const executionState = {
    runningCount: 0,
  };

  const listeners = new Set<(state: { getRunningCount: () => number }) => void>();

  const mockExecutionStore = {
    getState: () => ({
      getRunningCount: () => executionState.runningCount,
    }),
    subscribe: (listener: (state: { getRunningCount: () => number }) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return { executionState, listeners, mockExecutionStore };
});

vi.mock('@/stores/execution-store', () => ({
  useExecutionStore: mockExecutionStore,
}));

describe('keepAwakeManager', () => {
  beforeEach(() => {
    executionState.runningCount = 0;
    listeners.clear();
    vi.mocked(keepAwakeService.acquire).mockResolvedValue(true);
    vi.mocked(keepAwakeService.release).mockResolvedValue(true);
    vi.mocked(keepAwakeService.getRefCount).mockResolvedValue(0);
    keepAwakeManager.stop();
    vi.clearAllMocks();
  });

  const emit = () => {
    const state = mockExecutionStore.getState();
    listeners.forEach((listener) => listener(state));
  };

  it('should sync to running count on start', async () => {
    executionState.runningCount = 2;
    vi.mocked(keepAwakeService.getRefCount).mockResolvedValue(0);

    keepAwakeManager.start();
    await keepAwakeManager.waitForIdle();

    expect(keepAwakeService.acquire).toHaveBeenCalledTimes(2);
  });

  it('should apply deltas when running count changes', async () => {
    executionState.runningCount = 1;
    vi.mocked(keepAwakeService.getRefCount).mockResolvedValue(1);

    keepAwakeManager.start();
    await keepAwakeManager.waitForIdle();

    vi.clearAllMocks();

    executionState.runningCount = 3;
    emit();
    await keepAwakeManager.waitForIdle();

    expect(keepAwakeService.acquire).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    executionState.runningCount = 1;
    emit();
    await keepAwakeManager.waitForIdle();

    expect(keepAwakeService.release).toHaveBeenCalledTimes(2);
  });

  it('should be idempotent on start', async () => {
    executionState.runningCount = 1;
    keepAwakeManager.start();
    keepAwakeManager.start();
    await keepAwakeManager.waitForIdle();

    expect(listeners.size).toBe(1);
  });

  it('should stop and reset state', () => {
    executionState.runningCount = 1;
    keepAwakeManager.start();

    keepAwakeManager.stop();

    expect(listeners.size).toBe(0);
    expect(keepAwakeManager.getSnapshot().runningCount).toBe(0);
  });

  it('should reconcile running count changes during initial sync', async () => {
    executionState.runningCount = 1;

    let resolveAcquire: (() => void) | null = null;
    const acquirePromise = new Promise<void>((resolve) => {
      resolveAcquire = resolve;
    });

    let notifyAcquireStarted: (() => void) | null = null;
    const acquireStarted = new Promise<void>((resolve) => {
      notifyAcquireStarted = resolve;
    });

    vi.mocked(keepAwakeService.getRefCount).mockResolvedValue(0);
    vi.mocked(keepAwakeService.acquire).mockImplementation(async () => {
      notifyAcquireStarted?.();
      await acquirePromise;
      return true;
    });

    keepAwakeManager.start();

    await acquireStarted;
    executionState.runningCount = 0;
    emit();

    resolveAcquire?.();
    await keepAwakeManager.waitForIdle();

    expect(keepAwakeService.acquire).toHaveBeenCalledTimes(1);
    expect(keepAwakeService.release).toHaveBeenCalledTimes(1);
    expect(keepAwakeManager.getSnapshot().runningCount).toBe(0);
  });
});
