import { describe, expect, it, vi } from 'vitest';

const mockRun = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));
vi.mock('@/services/auto-code-review-service', () => ({
  autoCodeReviewService: {
    run: mockRun,
  },
  lastReviewedChangeTimestamp: {
    delete: mockDelete,
  },
}));

describe('AutoCodeReviewHookService', () => {
  it('returns hidden system continuation instead of visible user message', async () => {
    mockRun.mockResolvedValueOnce('## REVIEW SUMMARY\nIssue found');

    const { AutoCodeReviewHookService } = await import('./auto-code-review-hook-service');
    const service = new AutoCodeReviewHookService();

    const result = await service.run({ taskId: 'task-1' });

    expect(result.action).toBe('continue');
    expect(result.nextMessages).toHaveLength(1);
    expect(result.nextMessages?.[0]?.role).toBe('system');
    expect(String(result.nextMessages?.[0]?.content)).toContain('Issue found');
    expect(String(result.nextMessages?.[0]?.content)).toContain('Do not treat this as a user request');
  });

  it('stops when review returns no issues', async () => {
    mockRun.mockResolvedValueOnce(null);

    const { AutoCodeReviewHookService } = await import('./auto-code-review-hook-service');
    const service = new AutoCodeReviewHookService();

    const result = await service.run({ taskId: 'task-2' });

    expect(result).toEqual({ action: 'stop' });
    expect(mockDelete).toHaveBeenCalledWith('task-2');
  });
});
