// src/services/api-usage-service.ts

import type { ApiUsageRange, ApiUsageRangeResult, ApiUsageTokenView } from '@/types/api-usage';
import { databaseService } from './database-service';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getRangeWindow(
  range: ApiUsageRange,
  now: number = Date.now()
): {
  startAt: number;
  endAt: number;
} {
  const endAt = now;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (range === 'today') {
    return { startAt: startOfToday.getTime(), endAt };
  }

  const days = range === 'week' ? 7 : 30;
  const startAt = startOfToday.getTime() - (days - 1) * DAY_MS;
  return { startAt, endAt };
}

export function getTokenValue(
  view: ApiUsageTokenView,
  input: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  }
): number {
  if (view === 'input') return input.inputTokens;
  if (view === 'output') return input.outputTokens;
  return input.totalTokens;
}

export async function fetchApiUsageRange(range: ApiUsageRange): Promise<ApiUsageRangeResult> {
  const { startAt, endAt } = getRangeWindow(range);
  return databaseService.getApiUsageRangeResult(startAt, endAt);
}
