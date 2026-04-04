// use-task-keep-awake.test.tsx - Unit tests for useTaskKeepAwake hook

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTaskKeepAwake, useIsPreventingSleep } from './use-task-keep-awake';

// Mock keep-awake manager
const { snapshot, listeners, mockManager } = vi.hoisted(() => {
  const snapshot = {
    isPreventing: false,
    refCount: 0,
    runningCount: 0,
  };

  const listeners = new Set<() => void>();

  const mockManager = {
    getSnapshot: vi.fn(() => snapshot),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
  };

  return { snapshot, listeners, mockManager };
});

vi.mock('@/services/keep-awake-manager', () => ({
  keepAwakeManager: mockManager,
}));

describe('useTaskKeepAwake', () => {
  beforeEach(() => {
    snapshot.isPreventing = false;
    snapshot.refCount = 0;
    snapshot.runningCount = 0;
    listeners.clear();
    vi.clearAllMocks();
  });

  it('should return snapshot values', () => {
    snapshot.isPreventing = true;
    snapshot.refCount = 2;
    snapshot.runningCount = 2;

    const { result } = renderHook(() => useTaskKeepAwake());

    expect(result.current.isPreventing).toBe(true);
    expect(result.current.refCount).toBe(2);
    expect(result.current.runningCount).toBe(2);
  });

  it('should update when snapshot changes', () => {
    const { result, rerender } = renderHook(() => useTaskKeepAwake());

    expect(result.current.isPreventing).toBe(false);

    snapshot.isPreventing = true;
    snapshot.refCount = 1;
    snapshot.runningCount = 1;
    listeners.forEach((listener) => listener());

    rerender();

    expect(result.current.isPreventing).toBe(true);
    expect(result.current.refCount).toBe(1);
    expect(result.current.runningCount).toBe(1);
  });
});

describe('useIsPreventingSleep', () => {
  it('should return isPreventing value from useTaskKeepAwake', () => {
    snapshot.isPreventing = true;
    snapshot.refCount = 1;
    snapshot.runningCount = 1;

    const { result } = renderHook(() => useIsPreventingSleep());

    expect(result.current).toBe(true);
  });
});
