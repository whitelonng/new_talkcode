// use-task-keep-awake.ts - React hook for keep-awake status
//
// This hook reads keep-awake state managed outside React to avoid lifecycle issues.

import { useSyncExternalStore } from 'react';
import { type KeepAwakeSnapshot, keepAwakeManager } from '@/services/keep-awake-manager';

/**
 * Hook for keep-awake state during task execution
 *
 * @returns Object containing sleep prevention status
 */
export function useTaskKeepAwake(): KeepAwakeSnapshot {
  return useSyncExternalStore(
    keepAwakeManager.subscribe,
    keepAwakeManager.getSnapshot,
    keepAwakeManager.getSnapshot
  );
}

/**
 * Simpler hook that just returns sleep prevention status
 * Use this if you don't need detailed counts
 */
export function useIsPreventingSleep(): boolean {
  const { isPreventing } = useTaskKeepAwake();
  return isPreventing;
}
