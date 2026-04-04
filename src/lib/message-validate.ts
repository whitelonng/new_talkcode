// src/lib/message-validate.ts
// Message validation functions for Anthropic API compliance

import { logger } from '@/lib/logger';
import type { ContentPart, Message as ModelMessage } from '@/services/llm/types';

/**
 * Validation issue codes for Anthropic message format compliance
 */
export type ValidationIssueCode =
  | 'SCATTERED_SYSTEM' // System messages not at the beginning
  | 'CONSECUTIVE_ASSISTANT' // Consecutive assistant messages
  | 'ORPHANED_TOOL_CALL' // Tool-call without matching tool-result
  | 'ORPHANED_TOOL_RESULT' // Tool-result without matching tool-call
  | 'EMPTY_ASSISTANT' // Assistant message with empty content
  | 'ASSISTANT_TRAILING_WHITESPACE'; // Assistant message ends with whitespace

/**
 * Represents a single validation issue found in messages
 */
export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  index?: number;
  toolCallId?: string;
}

/**
 * Result of message validation
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Type guard for assistant content parts
 */
type AssistantContentPart = Extract<ContentPart, { type: 'text' | 'tool-call' }>;

/**
 * Validates that system messages are only at the beginning of the message array.
 * Anthropic requirement: System messages must be contiguous at the start,
 * they cannot be scattered throughout the conversation.
 */
export function validateSystemMessages(messages: ModelMessage[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  let systemBlockEnded = false;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;

    if (msg.role === 'system') {
      if (systemBlockEnded) {
        issues.push({
          code: 'SCATTERED_SYSTEM',
          message: `System message at index ${i} is not at the beginning. System messages must be contiguous at the start.`,
          index: i,
        });
      }
    } else {
      systemBlockEnded = true;
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validates message sequence follows proper alternation.
 * - After system block, messages should alternate between user and assistant
 * - Tool messages are considered part of the user block (per AI SDK groupIntoBlocks)
 * - Consecutive assistant messages are not allowed
 */
export function validateMessageSequence(messages: ModelMessage[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Skip system messages at the beginning
  let startIndex = 0;
  while (startIndex < messages.length && messages[startIndex]?.role === 'system') {
    startIndex++;
  }

  let prevEffectiveRole: 'user' | 'assistant' | null = null;

  for (let i = startIndex; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;

    // Tool messages are effectively part of the user block (AI SDK groups them together)
    const effectiveRole = msg.role === 'tool' ? 'user' : (msg.role as 'user' | 'assistant');

    if (effectiveRole === 'assistant' && prevEffectiveRole === 'assistant') {
      issues.push({
        code: 'CONSECUTIVE_ASSISTANT',
        message: `Consecutive assistant messages detected at index ${i}. Anthropic API doesn't allow consecutive assistant messages.`,
        index: i,
      });
    }

    prevEffectiveRole = effectiveRole;
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validates that all tool-calls have matching tool-results and vice versa.
 * Every tool-call must have a corresponding tool-result with the same toolCallId.
 */
export function validateToolPairing(messages: ModelMessage[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const toolCallIds = new Set<string>();
  const toolResultIds = new Set<string>();

  // Collect all tool-call IDs
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const part of msg.content as AssistantContentPart[]) {
        if (part.type === 'tool-call' && part.toolCallId) {
          toolCallIds.add(part.toolCallId);
        }
      }
    }
  }

  // Collect all tool-result IDs
  for (const msg of messages) {
    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      for (const part of msg.content as ContentPart[]) {
        if (part.type === 'tool-result' && part.toolCallId) {
          toolResultIds.add(part.toolCallId);
        }
      }
    }
  }

  // Check for orphaned tool-calls (no matching tool-result)
  for (const callId of toolCallIds) {
    if (!toolResultIds.has(callId)) {
      issues.push({
        code: 'ORPHANED_TOOL_CALL',
        message: `Tool-call "${callId}" has no matching tool-result`,
        toolCallId: callId,
      });
    }
  }

  // Check for orphaned tool-results (no matching tool-call)
  for (const resultId of toolResultIds) {
    if (!toolCallIds.has(resultId)) {
      issues.push({
        code: 'ORPHANED_TOOL_RESULT',
        message: `Tool-result "${resultId}" has no matching tool-call`,
        toolCallId: resultId,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validates assistant message content is not empty.
 */
export function validateAssistantContent(messages: ModelMessage[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') continue;

    let hasContent = false;

    if (typeof msg.content === 'string') {
      hasContent = msg.content.trim().length > 0;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as AssistantContentPart[]) {
        if (part.type === 'text' && part.text?.trim()) {
          hasContent = true;
          break;
        }
        if (part.type === 'tool-call') {
          hasContent = true;
          break;
        }
      }
    }

    if (!hasContent) {
      issues.push({
        code: 'EMPTY_ASSISTANT',
        message: `Assistant message at index ${i} has empty content`,
        index: i,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validates that the last assistant message doesn't have trailing whitespace.
 * Anthropic API requirement: Pre-filled assistant responses must not end with whitespace.
 */
export function validateAssistantTrailingWhitespace(messages: ModelMessage[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Find the last assistant message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') continue;

    if (typeof msg.content === 'string') {
      if (msg.content !== msg.content.trimEnd()) {
        issues.push({
          code: 'ASSISTANT_TRAILING_WHITESPACE',
          message: `Last assistant message at index ${i} has trailing whitespace`,
          index: i,
        });
      }
    } else if (Array.isArray(msg.content)) {
      // Find the last text part
      for (let j = msg.content.length - 1; j >= 0; j--) {
        const part = (msg.content as AssistantContentPart[])[j];
        if (part?.type === 'text' && part.text) {
          if (part.text !== part.text.trimEnd()) {
            issues.push({
              code: 'ASSISTANT_TRAILING_WHITESPACE',
              message: `Last assistant message at index ${i} has trailing whitespace in text part`,
              index: i,
            });
          }
          break;
        }
      }
    }
    break; // Only check the last assistant message
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Main validation entry point - validates all Anthropic message format constraints.
 * Combines all individual validation functions and returns a comprehensive result.
 */
export function validateAnthropicMessages(messages: ModelMessage[]): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  // Run all validations
  const systemResult = validateSystemMessages(messages);
  const sequenceResult = validateMessageSequence(messages);
  const toolPairingResult = validateToolPairing(messages);
  const assistantContentResult = validateAssistantContent(messages);
  const whitespaceResult = validateAssistantTrailingWhitespace(messages);

  // Collect all issues
  allIssues.push(...systemResult.issues);
  allIssues.push(...sequenceResult.issues);
  allIssues.push(...toolPairingResult.issues);
  allIssues.push(...assistantContentResult.issues);
  allIssues.push(...whitespaceResult.issues);

  const isValid = allIssues.length === 0;

  if (!isValid) {
    logger.debug('[validateAnthropicMessages] Validation issues found:', {
      issueCount: allIssues.length,
      issues: allIssues,
    });
  }

  return { valid: isValid, issues: allIssues };
}

/**
 * Quick check if messages are valid for Anthropic API.
 * Returns true if valid, false otherwise (without details).
 */
export function isValidAnthropicMessages(messages: ModelMessage[]): boolean {
  return validateAnthropicMessages(messages).valid;
}
