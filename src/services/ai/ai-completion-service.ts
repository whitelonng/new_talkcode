import { logger } from '@/lib/logger';
import { modelTypeService } from '@/providers/models/model-type-service';
import { llmClient } from '@/services/llm/llm-client';
import type { CompletionContext, CompletionResult } from '@/services/llm/types';
import { ModelType } from '@/types/model-types';

class AICompletionService {
  async getCompletion(context: CompletionContext): Promise<CompletionResult | null> {
    try {
      logger.info('getCompletion context', {
        fileName: context.fileName,
        language: context.language,
        cursorPosition: context.cursorPosition,
        contentLength: context.fileContent.length,
      });

      const model = await modelTypeService.resolveModelType(ModelType.MAIN);

      const result = await llmClient.getCompletion({
        ...context,
        model,
      });

      if (result.completion) {
        logger.info('AI Completion result:', result.completion);
        return result;
      }

      return null;
    } catch (error) {
      logger.error('AI completion error:', error);
      return null;
    }
  }
}

export const aiCompletionService = new AICompletionService();
