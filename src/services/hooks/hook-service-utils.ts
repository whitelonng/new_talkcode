import type { HookRunSummary } from '@/types/hooks';

export function emptyHookSummary(): HookRunSummary {
  return {
    blocked: false,
    continue: true,
    additionalContext: [],
  };
}
