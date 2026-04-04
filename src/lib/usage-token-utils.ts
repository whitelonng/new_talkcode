export type UsageLike = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cached_tokens?: number;
};

export type NormalizedUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
};

const getNumber = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
};

export class UsageTokenUtils {
  static normalizeUsageTokens(
    usage?: UsageLike | null,
    totalUsage?: UsageLike | null
  ): NormalizedUsage | null {
    const primary = usage ?? totalUsage ?? null;
    const hasPrimaryTokens = [
      primary?.inputTokens,
      primary?.outputTokens,
      primary?.promptTokens,
      primary?.completionTokens,
      primary?.prompt_tokens,
      primary?.completion_tokens,
      primary?.totalTokens,
      primary?.total_tokens,
    ].some((value) => typeof value === 'number' && value > 0);
    const effective = hasPrimaryTokens ? primary : (totalUsage ?? null);

    const inputTokens = getNumber(
      effective?.inputTokens,
      effective?.promptTokens,
      effective?.prompt_tokens,
      totalUsage?.inputTokens,
      totalUsage?.promptTokens,
      totalUsage?.prompt_tokens
    );
    const outputTokens = getNumber(
      effective?.outputTokens,
      effective?.completionTokens,
      effective?.completion_tokens,
      totalUsage?.outputTokens,
      totalUsage?.completionTokens,
      totalUsage?.completion_tokens
    );
    const cachedInputTokens =
      effective?.cachedInputTokens ??
      effective?.cached_tokens ??
      totalUsage?.cachedInputTokens ??
      totalUsage?.cached_tokens ??
      undefined;
    const cacheCreationInputTokens =
      effective?.cacheCreationInputTokens ?? totalUsage?.cacheCreationInputTokens ?? undefined;
    let totalTokens = getNumber(
      effective?.totalTokens,
      effective?.total_tokens,
      totalUsage?.totalTokens,
      totalUsage?.total_tokens,
      inputTokens + outputTokens
    );

    if (totalTokens > 0 && (inputTokens > 0 || outputTokens > 0)) {
      totalTokens = inputTokens + outputTokens;
    }

    if (totalTokens > 0 && inputTokens === 0 && outputTokens === 0) {
      const normalized: NormalizedUsage = {
        inputTokens: totalTokens,
        outputTokens: 0,
        totalTokens,
      };
      if (cachedInputTokens !== undefined) {
        normalized.cachedInputTokens = cachedInputTokens;
      }
      if (cacheCreationInputTokens !== undefined) {
        normalized.cacheCreationInputTokens = cacheCreationInputTokens;
      }
      return normalized;
    }

    if (totalTokens === 0 && (inputTokens > 0 || outputTokens > 0)) {
      totalTokens = inputTokens + outputTokens;
    }

    if (totalTokens === 0) return null;

    const normalized: NormalizedUsage = { inputTokens, outputTokens, totalTokens };
    if (cachedInputTokens !== undefined) {
      normalized.cachedInputTokens = cachedInputTokens;
    }
    if (cacheCreationInputTokens !== undefined) {
      normalized.cacheCreationInputTokens = cacheCreationInputTokens;
    }
    return normalized;
  }
}
