// src/services/database/api-usage-service.ts

import type {
  ApiUsageDailyPoint,
  ApiUsageModelBreakdown,
  ApiUsageRangeResult,
  ApiUsageSummary,
} from '@/types/api-usage';
import type { TursoClient } from './turso-client';

export class ApiUsageService {
  constructor(private db: TursoClient) {}

  async insertUsageEvent(input: {
    id: string;
    conversationId?: string | null;
    model: string;
    providerId?: string | null;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    createdAt: number;
  }): Promise<void> {
    await this.db.execute(
      `INSERT INTO api_usage_events (
        id,
        conversation_id,
        model,
        provider_id,
        input_tokens,
        output_tokens,
        cost,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.id,
        input.conversationId ?? null,
        input.model,
        input.providerId ?? null,
        input.inputTokens,
        input.outputTokens,
        input.cost,
        input.createdAt,
      ]
    );
  }

  async getRangeSummary(startAt: number, endAt: number): Promise<ApiUsageSummary> {
    const rows = await this.db.select<
      Array<{
        total_cost: number | null;
        input_tokens: number | null;
        output_tokens: number | null;
        request_count: number | null;
      }>
    >(
      `SELECT
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COUNT(*) as request_count
      FROM api_usage_events
      WHERE created_at >= $1 AND created_at <= $2`,
      [startAt, endAt]
    );

    const row = rows[0];
    const inputTokens = row?.input_tokens ?? 0;
    const outputTokens = row?.output_tokens ?? 0;

    return {
      totalCost: row?.total_cost ?? 0,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      requestCount: row?.request_count ?? 0,
    };
  }

  async getModelBreakdown(startAt: number, endAt: number): Promise<ApiUsageModelBreakdown[]> {
    const rows = await this.db.select<
      Array<{
        model: string;
        provider_id: string | null;
        total_cost: number | null;
        input_tokens: number | null;
        output_tokens: number | null;
        request_count: number | null;
        min_total_tokens: number | null;
        max_total_tokens: number | null;
        avg_total_tokens: number | null;
        min_input_tokens: number | null;
        max_input_tokens: number | null;
        avg_input_tokens: number | null;
        min_output_tokens: number | null;
        max_output_tokens: number | null;
        avg_output_tokens: number | null;
      }>
    >(
      `SELECT
        model,
        provider_id,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COUNT(*) as request_count,
        MIN(input_tokens + output_tokens) as min_total_tokens,
        MAX(input_tokens + output_tokens) as max_total_tokens,
        AVG(input_tokens + output_tokens) as avg_total_tokens,
        MIN(input_tokens) as min_input_tokens,
        MAX(input_tokens) as max_input_tokens,
        AVG(input_tokens) as avg_input_tokens,
        MIN(output_tokens) as min_output_tokens,
        MAX(output_tokens) as max_output_tokens,
        AVG(output_tokens) as avg_output_tokens
      FROM api_usage_events
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY model, provider_id
      ORDER BY total_cost DESC, request_count DESC`,
      [startAt, endAt]
    );

    if (rows.length > 0) {
      return rows.map((row) => {
        const inputTokens = row.input_tokens ?? 0;
        const outputTokens = row.output_tokens ?? 0;
        return {
          model: row.model,
          providerId: row.provider_id ?? null,
          totalCost: row.total_cost ?? 0,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          requestCount: row.request_count ?? 0,
          minTotalTokens: row.min_total_tokens ?? 0,
          maxTotalTokens: row.max_total_tokens ?? 0,
          avgTotalTokens: row.avg_total_tokens ?? 0,
          minInputTokens: row.min_input_tokens ?? 0,
          maxInputTokens: row.max_input_tokens ?? 0,
          avgInputTokens: row.avg_input_tokens ?? 0,
          minOutputTokens: row.min_output_tokens ?? 0,
          maxOutputTokens: row.max_output_tokens ?? 0,
          avgOutputTokens: row.avg_output_tokens ?? 0,
        };
      });
    }

    const fallbackRows = await this.db.select<
      Array<{
        model: string;
        total_cost: number | null;
        input_tokens: number | null;
        output_tokens: number | null;
        request_count: number | null;
        min_total_tokens: number | null;
        max_total_tokens: number | null;
        avg_total_tokens: number | null;
        min_input_tokens: number | null;
        max_input_tokens: number | null;
        avg_input_tokens: number | null;
        min_output_tokens: number | null;
        max_output_tokens: number | null;
        avg_output_tokens: number | null;
      }>
    >(
      `SELECT
        model,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COUNT(*) as request_count,
        MIN(input_tokens + output_tokens) as min_total_tokens,
        MAX(input_tokens + output_tokens) as max_total_tokens,
        AVG(input_tokens + output_tokens) as avg_total_tokens,
        MIN(input_tokens) as min_input_tokens,
        MAX(input_tokens) as max_input_tokens,
        AVG(input_tokens) as avg_input_tokens,
        MIN(output_tokens) as min_output_tokens,
        MAX(output_tokens) as max_output_tokens,
        AVG(output_tokens) as avg_output_tokens
      FROM api_usage_events
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY model
      ORDER BY total_cost DESC, request_count DESC`,
      [startAt, endAt]
    );

    return fallbackRows.map((row) => {
      const inputTokens = row.input_tokens ?? 0;
      const outputTokens = row.output_tokens ?? 0;
      return {
        model: row.model,
        providerId: null,
        totalCost: row.total_cost ?? 0,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        requestCount: row.request_count ?? 0,
        minTotalTokens: row.min_total_tokens ?? 0,
        maxTotalTokens: row.max_total_tokens ?? 0,
        avgTotalTokens: row.avg_total_tokens ?? 0,
        minInputTokens: row.min_input_tokens ?? 0,
        maxInputTokens: row.max_input_tokens ?? 0,
        avgInputTokens: row.avg_input_tokens ?? 0,
        minOutputTokens: row.min_output_tokens ?? 0,
        maxOutputTokens: row.max_output_tokens ?? 0,
        avgOutputTokens: row.avg_output_tokens ?? 0,
      };
    });
  }

  async getDailySeries(startAt: number, endAt: number): Promise<ApiUsageDailyPoint[]> {
    const rows = await this.db.select<
      Array<{
        day: string;
        total_cost: number | null;
        input_tokens: number | null;
        output_tokens: number | null;
        request_count: number | null;
      }>
    >(
      `SELECT
        date(created_at / 1000, 'unixepoch', 'localtime') as day,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COUNT(*) as request_count
      FROM api_usage_events
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY day
      ORDER BY day ASC`,
      [startAt, endAt]
    );

    return rows.map((row) => {
      const inputTokens = row.input_tokens ?? 0;
      const outputTokens = row.output_tokens ?? 0;
      return {
        date: row.day,
        totalCost: row.total_cost ?? 0,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        requestCount: row.request_count ?? 0,
      };
    });
  }

  async getRangeResult(startAt: number, endAt: number): Promise<ApiUsageRangeResult> {
    const [summary, daily, models] = await Promise.all([
      this.getRangeSummary(startAt, endAt),
      this.getDailySeries(startAt, endAt),
      this.getModelBreakdown(startAt, endAt),
    ]);

    return { summary, daily, models };
  }
}
