// src/types/api-usage.ts

export type ApiUsageRange = 'today' | 'week' | 'month';
export type ApiUsageTokenView = 'total' | 'input' | 'output';

export interface ApiUsageSummary {
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
}

export interface ApiUsageModelBreakdown {
  model: string;
  providerId: string | null;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  minTotalTokens: number;
  maxTotalTokens: number;
  avgTotalTokens: number;
  minInputTokens: number;
  maxInputTokens: number;
  avgInputTokens: number;
  minOutputTokens: number;
  maxOutputTokens: number;
  avgOutputTokens: number;
}

export interface ApiUsageDailyPoint {
  date: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  totalCost: number;
}

export interface ApiUsageRangeResult {
  summary: ApiUsageSummary;
  daily: ApiUsageDailyPoint[];
  models: ApiUsageModelBreakdown[];
}
