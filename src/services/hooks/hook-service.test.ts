import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hookService } from '@/services/hooks/hook-service';
import { hookStateService } from '@/services/hooks/hook-state-service';

vi.mock('@/services/workspace-root-service', () => ({
  getEffectiveWorkspaceRoot: vi.fn().mockResolvedValue('/workspace'),
}));

vi.mock('@/services/hooks/hook-runner', () => ({
  hookRunner: {
    runHooks: vi.fn().mockResolvedValue({
      blocked: false,
      continue: true,
      additionalContext: ['extra'],
    }),
  },
}));

describe('HookService', () => {
  beforeEach(() => {
    hookStateService.setHooksEnabled(true);
  });

  it('returns empty summary when hooks disabled', async () => {
    hookStateService.setHooksEnabled(false);
    const result = await hookService.runUserPromptSubmit('task-1', 'hi');
    expect(result.blocked).toBe(false);
    expect(result.additionalContext).toEqual([]);
  });

  it('applies additional context from hook summary', async () => {
    hookStateService.setHooksEnabled(true);
    const summary = await hookService.runUserPromptSubmit('task-1', 'hi');
    hookService.applyHookSummary(summary);
    const context = hookStateService.consumeAdditionalContext();
    expect(context).toEqual(['extra']);
  });
});
