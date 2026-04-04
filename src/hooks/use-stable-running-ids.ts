// src/hooks/use-stable-running-ids.ts
/**
 * useStableRunningIds - Hook that returns a stable reference to running task IDs
 *
 * This hook prevents unnecessary re-renders by returning the same array reference
 * when the actual running task IDs haven't changed.
 */

import { useShallow } from 'zustand/react/shallow';
import { useExecutionStore } from '@/stores/execution-store';

/**
 * Hook to get running task IDs with stable reference
 * @returns Array of running task IDs (stable reference)
 */
export function useStableRunningIds(): string[] {
  return useExecutionStore(useShallow((state) => state.getRunningTaskIds()));
}
