// src/services/agents/message-rewriter.ts

import { logger } from '@/lib/logger';
import { timedMethod } from '@/lib/timer';
import {
  type CodeSummary,
  getLangIdFromPath,
  summarizeCodeContent,
} from '@/services/code-navigation-service';
import type { ContentPart, Message as ModelMessage } from '@/services/llm/types';

// Type for assistant message content parts
type AssistantContentPart = Extract<ContentPart, { type: 'text' | 'tool-call' }>;

/**
 * MessageRewriter handles content rewriting for message compaction.
 * Uses tree-sitter to summarize large code files, keeping only signatures
 * and key definitions while reducing token usage.
 */
export class ContextRewriter {
  private readonly LINE_THRESHOLD = 100; // Only summarize files exceeding this line count

  /**
   * Rewrite messages to compress large code content using tree-sitter.
   * This method:
   * - Finds readFile tool results with large content and summarizes them
   * - Finds writeFile tool calls with large content and summarizes them
   * - Adds [COMPRESSED] marker to indicate content has been summarized
   */
  @timedMethod('ContextRewriter.rewriteMessages')
  async rewriteMessages(messages: ModelMessage[]): Promise<ModelMessage[]> {
    const result: ModelMessage[] = [];

    for (const message of messages) {
      if (message.role === 'tool' && Array.isArray(message.content)) {
        // Process tool results (readFile outputs)
        const processedContent = await this.processToolResults(message.content as ContentPart[]);
        result.push({
          ...message,
          content: processedContent,
        });
      } else if (message.role === 'assistant' && Array.isArray(message.content)) {
        // Process tool calls (writeFile inputs)
        const processedContent = await this.processToolCalls(
          message.content as AssistantContentPart[]
        );
        result.push({
          ...message,
          content: processedContent,
        });
      } else {
        result.push(message);
      }
    }

    return result;
  }

  /**
   * Process tool result messages to summarize large readFile outputs
   */
  private async processToolResults(parts: ContentPart[]): Promise<ContentPart[]> {
    const processedParts: ContentPart[] = [];

    for (const part of parts) {
      if (part.type === 'tool-result' && part.toolName === 'readFile') {
        const processed = await this.processReadFileResult(part);
        processedParts.push(processed);
      } else {
        processedParts.push(part);
      }
    }

    return processedParts;
  }

  /**
   * Process a readFile tool result to summarize large content
   */
  private async processReadFileResult(part: ContentPart): Promise<ContentPart> {
    try {
      if (part.type !== 'tool-result') {
        return part;
      }

      // llm-service always uses type: 'text' with JSON.stringify'd value
      const output = part.output as { type: 'text'; value: string };

      if (output?.type !== 'text' || typeof output.value !== 'string') {
        return part;
      }

      // Parse the JSON string
      let result: {
        success?: boolean;
        file_path?: string;
        content?: string;
        message?: string;
      };
      try {
        result = JSON.parse(output.value);
      } catch {
        return part; // Not valid JSON
      }

      if (!result?.success || !result.content || !result.file_path) {
        return part;
      }

      const lineCount = result.content.split('\n').length;
      if (lineCount <= this.LINE_THRESHOLD) {
        return part;
      }

      // Get language ID from file path
      const langId = getLangIdFromPath(result.file_path);
      if (!langId) {
        // Unsupported language, keep original
        return part;
      }

      // Summarize using tree-sitter
      const summary = await this.summarizeContent(result.content, langId, result.file_path);

      if (!summary.success) {
        // Summarization failed (unsupported language), keep original
        return part;
      }

      // Return modified result with summarized content (keep type: 'text' to match input format)
      return {
        ...part,
        output: {
          type: 'text',
          value: JSON.stringify(
            {
              ...result,
              content: summary.summary,
              message: `${result.message} [COMPRESSED: ${summary.original_lines} lines → summarized]`,
            },
            null,
            2
          ),
        },
      };
    } catch (error) {
      logger.error('MessageRewriter: Failed to process readFile result:', error);
      return part;
    }
  }

  /**
   * Process tool call messages to summarize large writeFile content
   */
  private async processToolCalls(parts: AssistantContentPart[]): Promise<AssistantContentPart[]> {
    const processedParts: AssistantContentPart[] = [];

    for (const part of parts) {
      if (part.type === 'tool-call' && part.toolName === 'writeFile') {
        const processed = await this.processWriteFileCall(part);
        processedParts.push(processed);
      } else {
        processedParts.push(part);
      }
    }

    return processedParts;
  }

  /**
   * Process a writeFile tool call to summarize large content
   */
  private async processWriteFileCall(
    part: Extract<AssistantContentPart, { type: 'tool-call' }>
  ): Promise<AssistantContentPart> {
    try {
      // input is the arguments passed to the tool
      let input: Record<string, unknown>;
      if (typeof part.input === 'string') {
        try {
          input = JSON.parse(part.input);
        } catch (parseError) {
          logger.error('MessageRewriter: Failed to parse writeFile input as JSON:', {
            error: parseError,
            inputPreview: part.input.substring(0, 200),
          });
          return part;
        }
      } else {
        input = part.input as Record<string, unknown>;
      }

      const filePath = input?.file_path as string | undefined;
      const content = input?.content as string | undefined;

      if (!filePath || !content) {
        return part;
      }

      const lineCount = content.split('\n').length;
      if (lineCount <= this.LINE_THRESHOLD) {
        return part;
      }

      // Get language ID from file path
      const langId = getLangIdFromPath(filePath);
      if (!langId) {
        // Unsupported language, keep original
        return part;
      }

      // Summarize using tree-sitter
      const summary = await this.summarizeContent(content, langId, filePath);

      if (!summary.success) {
        // Summarization failed (unsupported language), keep original
        return part;
      }

      const originalChars = content.length;
      const summaryChars = summary.summary.length;
      const summaryLines = summary.summary.split('\n').length;
      const charReduction = Math.round((1 - summaryChars / originalChars) * 100);

      logger.info(`MessageRewriter: Compressed writeFile call for ${filePath}`, {
        original: { lines: summary.original_lines, chars: originalChars },
        summary: { lines: summaryLines, chars: summaryChars },
        reduction: `${charReduction}%`,
      });

      // Return modified tool call with summarized content
      return {
        ...part,
        input: {
          file_path: filePath,
          content: summary.summary,
        },
      };
    } catch (error) {
      logger.error('MessageRewriter: Failed to process writeFile call:', error);
      return part;
    }
  }

  private async summarizeContent(
    content: string,
    langId: string,
    filePath: string
  ): Promise<CodeSummary> {
    try {
      return await summarizeCodeContent(content, langId, filePath);
    } catch (error) {
      logger.error('MessageRewriter: Failed to summarize content:', error);
      return {
        success: false,
        summary: content,
        original_lines: content.split('\n').length,
        lang_id: langId,
      };
    }
  }
}
