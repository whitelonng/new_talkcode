import { logger } from '@/lib/logger';
import { MODEL_CONFIGS } from '@/providers/config/model-config';
import { llmClient } from '@/services/llm/llm-client';
import type { TokenUsage } from '@/services/llm/types';

class AIPricingService {
  async calculateCost(modelId: string, usage: TokenUsage): Promise<number> {
    try {
      const result = await llmClient.calculateCost({
        modelId,
        usage,
        modelConfigs: MODEL_CONFIGS as unknown as Record<
          string,
          import('@/services/llm/types').ModelConfig
        >,
      });
      return result.cost;
    } catch (error) {
      logger.error('Failed to calculate cost:', error);
      return 0;
    }
  }
}

export const aiPricingService = new AIPricingService();
export type { TokenUsage };
