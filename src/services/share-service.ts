// src/services/share-service.ts
// Desktop app share service for creating and managing task shares

import type {
  CreateShareRequest,
  CreateShareResponse,
  ShareAttachment,
  ShareMessage,
  ShareOptions,
  ShareToolContent,
  TaskShareSnapshot,
} from '@talkcody/shared/types/share';
import type {
  CodeSearchOutput,
  DiffLine,
  EditFileOutput,
  ReadFileOutput,
  TodoItem,
  TodoWriteOutput,
  WriteFileOutput,
} from '@talkcody/shared/types/share-tools';
import { formatToolInputSummary } from '@talkcody/shared/utils';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { logger } from '@/lib/logger';
import { simpleFetch } from '@/lib/tauri-fetch';
import { useFileChangesStore } from '@/stores/file-changes-store';
import type { Task, UIMessage } from '@/types';
import type { MessageAttachment, ToolMessageContent } from '@/types/agent';

// API base URL with environment variable support
const API_BASE_URL =
  import.meta.env.VITE_API_URL_PROD || import.meta.env.VITE_API_URL || 'https://api.talkcody.com';

/**
 * Get device ID from Tauri backend
 * Device ID is securely stored in app data directory
 */
async function getDeviceId(): Promise<string> {
  try {
    return await invoke<string>('get_device_id');
  } catch (error) {
    logger.error('[ShareService] Failed to get device ID:', error);
    throw new Error('Failed to get device ID');
  }
}

/**
 * Sanitize file path to remove sensitive information
 * Handles various path formats across platforms
 */
function sanitizePath(path: string): string {
  // Handle macOS user paths (/Users/username/...)
  if (path.match(/^\/Users\/[^/]+/)) {
    return path.replace(/^\/Users\/[^/]+/, '~');
  }

  // Handle Windows local paths (C:\Users\username\...)
  if (path.match(/^[A-Z]:\\Users\\/i)) {
    return path.replace(/^[A-Z]:\\Users\\[^\\]+/i, '~').replace(/\\/g, '/');
  }

  // Handle Windows network paths (\\server\share\...)
  if (path.match(/^\\\\[^\\]+\\/)) {
    const parts = path.split('\\').filter(Boolean);
    if (parts.length > 0) {
      return `[network]/${parts.slice(2).join('/')}`;
    }
  }

  // Handle Linux/Unix user paths (/home/username/...)
  if (path.match(/^\/home\/[^/]+/)) {
    return path.replace(/^\/home\/[^/]+/, '~');
  }

  // Handle mounted volumes with usernames (/Volumes/username/... or /mnt/username/...)
  if (path.match(/\/(Volumes|mnt)\/[^/]*[Uu]sers?[^/]*\//)) {
    return path.replace(/\/(Volumes|mnt)\/[^/]+/, '[volume]');
  }

  // Handle WSL paths (/mnt/c/Users/username/...)
  if (path.match(/^\/mnt\/[a-z]\/Users\//i)) {
    return path.replace(/^\/mnt\/[a-z]\/Users\/[^/]+/i, '~');
  }

  return path;
}

/**
 * Simple line-by-line diff calculation for editFile tool
 */
function calculateSimpleDiff(
  originalContent: string,
  newContent: string
): { diff: DiffLine[]; stats: { added: number; removed: number } } {
  const originalLines = originalContent.split('\n');
  const newLines = newContent.split('\n');

  // Find common prefix
  let prefixSize = 0;
  while (
    prefixSize < originalLines.length &&
    prefixSize < newLines.length &&
    originalLines[prefixSize] === newLines[prefixSize]
  ) {
    prefixSize++;
  }

  // Find common suffix
  let suffixSize = 0;
  while (
    suffixSize < originalLines.length - prefixSize &&
    suffixSize < newLines.length - prefixSize &&
    originalLines[originalLines.length - 1 - suffixSize] ===
      newLines[newLines.length - 1 - suffixSize]
  ) {
    suffixSize++;
  }

  const diff: DiffLine[] = [];
  let added = 0;
  let removed = 0;

  // Add context lines before changes (max 3 lines)
  const contextStart = Math.max(0, prefixSize - 3);
  for (let i = contextStart; i < prefixSize; i++) {
    diff.push({
      type: 'unchanged',
      content: originalLines[i] || '',
      originalLineNumber: i + 1,
      newLineNumber: i + 1,
    });
  }

  // Add removed lines
  for (let i = prefixSize; i < originalLines.length - suffixSize; i++) {
    diff.push({
      type: 'removed',
      content: originalLines[i] || '',
      originalLineNumber: i + 1,
    });
    removed++;
  }

  // Add added lines
  for (let i = prefixSize; i < newLines.length - suffixSize; i++) {
    diff.push({
      type: 'added',
      content: newLines[i] || '',
      newLineNumber: i + 1,
    });
    added++;
  }

  // Add context lines after changes (max 3 lines)
  const contextEnd = Math.min(originalLines.length - suffixSize + 3, originalLines.length);
  for (let i = originalLines.length - suffixSize; i < contextEnd; i++) {
    const originalIdx = i;
    const newIdx = newLines.length - suffixSize + (i - (originalLines.length - suffixSize));
    diff.push({
      type: 'unchanged',
      content: originalLines[originalIdx] || '',
      originalLineNumber: originalIdx + 1,
      newLineNumber: newIdx + 1,
    });
  }

  return { diff, stats: { added, removed } };
}

/**
 * Optimize tool output for sharing - keep only display-essential data
 */
function optimizeToolOutput(
  toolName: string,
  input: unknown,
  output: unknown,
  taskId?: string,
  toolCallId?: string
): unknown {
  // ReadFile: extract file_path and content
  if (toolName === 'readFile') {
    if (typeof output === 'object' && output !== null) {
      const obj = output as Record<string, unknown>;
      if ('file_path' in obj && 'content' in obj) {
        const result: ReadFileOutput = {
          file_path: sanitizePath(String(obj.file_path)),
          content: String(obj.content),
        };
        return result;
      }
    }
  }

  // WriteFile: extract file_path and content from input
  if (toolName === 'writeFile') {
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      if ('file_path' in obj && 'content' in obj) {
        const result: WriteFileOutput = {
          file_path: sanitizePath(String(obj.file_path)),
          content: String(obj.content),
        };
        return result;
      }
    }
  }

  // EditFile: calculate diff and save only that
  if (toolName === 'editFile') {
    if (typeof input === 'object' && input !== null) {
      const inputObj = input as Record<string, unknown>;

      if ('file_path' in inputObj && taskId && toolCallId) {
        const filePath = String(inputObj.file_path);

        // Get file changes from store
        const fileChanges = useFileChangesStore.getState().getChanges(taskId);

        // Find the matching change by toolCallId (stored as toolId) and file path
        const fileChange = fileChanges.find(
          (change) => change.toolId === toolCallId && change.filePath === filePath
        );

        if (fileChange?.originalContent && fileChange?.newContent) {
          const { diff, stats } = calculateSimpleDiff(
            fileChange.originalContent,
            fileChange.newContent
          );

          const result: EditFileOutput = {
            file_path: sanitizePath(filePath),
            diff,
            stats,
          };
          return result;
        }
      }
    }
  }

  // TodoWrite: extract todos array
  if (toolName === 'todoWrite') {
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      if ('todos' in obj && Array.isArray(obj.todos)) {
        const result: TodoWriteOutput = {
          todos: obj.todos as TodoItem[],
        };
        return result;
      }
    }
  }

  // CodeSearch: keep only essential fields
  if (toolName === 'codeSearch') {
    if (typeof output === 'object' && output !== null) {
      const obj = output as Record<string, unknown>;
      if ('success' in obj && 'result' in obj) {
        const result: CodeSearchOutput = {
          success: Boolean(obj.success),
          result: String(obj.result),
          error: obj.error ? String(obj.error) : undefined,
        };
        return result;
      }
    }
  }

  // Fallback to generic sanitization
  return sanitizeToolOutput(toolName, output);
}

/**
 * Sanitize tool output to remove sensitive information
 */
function sanitizeToolOutput(toolName: string, output: unknown): unknown {
  if (!output) return output;

  const sensitiveTools = ['bash'];

  if (sensitiveTools.includes(toolName)) {
    // For sensitive tools, only show a summary
    if (typeof output === 'object' && output !== null) {
      const obj = output as Record<string, unknown>;
      if ('success' in obj) {
        return { success: obj.success, summary: 'Output hidden for privacy' };
      }
    }
    return { summary: 'Output hidden for privacy' };
  }

  // For other tools, sanitize any paths in the output
  if (typeof output === 'string') {
    return sanitizePath(output);
  }

  if (typeof output === 'object' && output !== null) {
    return JSON.parse(
      JSON.stringify(output, (_key, value) => {
        if (
          typeof value === 'string' &&
          (value.includes('/Users/') || value.includes('C:\\Users\\'))
        ) {
          return sanitizePath(value);
        }
        return value;
      })
    );
  }

  return output;
}

/**
 * Convert UIMessage to ShareMessage
 */
function convertToShareMessage(message: UIMessage, taskId?: string): ShareMessage {
  let content: string | ShareToolContent[];

  if (typeof message.content === 'string') {
    // Sanitize any paths in text content
    content = sanitizePath(message.content);
  } else if (Array.isArray(message.content)) {
    // Convert tool content
    content = message.content.map((item: ToolMessageContent): ShareToolContent => {
      // Use optimized output for display-essential data only
      const optimizedOutput = optimizeToolOutput(
        item.toolName,
        item.input,
        item.output,
        taskId,
        item.toolCallId
      );

      // For summary, use sanitized input
      const sanitizedInput = item.input
        ? (sanitizeToolOutput(item.toolName, item.input) as Record<string, unknown>)
        : {};

      return {
        type: item.type,
        toolCallId: item.toolCallId,
        toolName: item.toolName,
        summary: formatToolInputSummary(item.toolName, sanitizedInput, {
          output: optimizedOutput,
          sanitize: true,
        }),
        input: undefined, // Don't save input - not needed for display
        output: optimizedOutput,
      };
    });
  } else {
    content = '';
  }

  // Convert attachments
  let attachments: ShareAttachment[] | undefined;
  if (message.attachments && message.attachments.length > 0) {
    attachments = message.attachments.map(
      (att: MessageAttachment): ShareAttachment => ({
        id: att.id,
        type: att.type,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        // For images, include preview if available
        preview: att.type === 'image' && att.content ? att.content : undefined,
      })
    );
  }

  // Convert nested tools recursively
  let nestedTools: ShareMessage[] | undefined;
  if (message.nestedTools && message.nestedTools.length > 0) {
    nestedTools = message.nestedTools.map((msg) => convertToShareMessage(msg, taskId));
  }

  return {
    id: message.id,
    role: message.role === 'system' ? 'assistant' : message.role,
    content,
    timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : message.timestamp,
    attachments,
    nestedTools,
  };
}

/**
 * Create a share snapshot from task and messages
 */
async function createSnapshot(task: Task, messages: UIMessage[]): Promise<TaskShareSnapshot> {
  const appVersion = await getVersion();
  const platformName = platform();

  // Filter out system messages and empty messages
  const filteredMessages = messages.filter(
    (msg) =>
      msg.role !== 'system' &&
      (typeof msg.content === 'string' ? msg.content.trim().length > 0 : msg.content.length > 0)
  );

  const shareMessages = filteredMessages.map((msg) => convertToShareMessage(msg, task.id));

  return {
    version: '1.0',
    task: {
      id: task.id,
      title: task.title,
      createdAt: task.created_at,
      messageCount: shareMessages.length,
      model: task.model,
    },
    messages: shareMessages,
    metadata: {
      sharedAt: Date.now(),
      talkcodyVersion: appVersion,
      platform: platformName as 'macos' | 'windows' | 'linux',
    },
  };
}

/**
 * Share a task to the cloud
 */
export async function shareTask(
  task: Task,
  messages: UIMessage[],
  options?: ShareOptions
): Promise<CreateShareResponse> {
  const snapshot = await createSnapshot(task, messages);

  // Check size (warn if > 2MB)
  const snapshotJson = JSON.stringify(snapshot);
  const sizeInBytes = new Blob([snapshotJson]).size;
  if (sizeInBytes > 2 * 1024 * 1024) {
    logger.warn('[ShareService] Share size exceeds 2MB:', sizeInBytes);
  }

  // Prepare request
  const request: CreateShareRequest = {
    snapshot,
    options,
  };

  // Get device ID for tracking
  const deviceId = await getDeviceId();

  // Send to API
  logger.info('[ShareService] Sending request to:', `${API_BASE_URL}/api/shares`);
  let response: Response;
  try {
    response = await simpleFetch(`${API_BASE_URL}/api/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId,
      },
      body: JSON.stringify(request),
    });
    logger.info('[ShareService] Response status:', response.status);
  } catch (error) {
    logger.error('[ShareService] Fetch error:', error);
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[ShareService] Failed to create share:', errorText);
    throw new Error(`Failed to create share: ${response.status}`);
  }

  const result = (await response.json()) as CreateShareResponse;
  logger.info('[ShareService] Share created:', result.shareId);

  return result;
}

/**
 * Delete a share
 */
export async function deleteShare(shareId: string): Promise<boolean> {
  const deviceId = await getDeviceId();

  try {
    const response = await simpleFetch(`${API_BASE_URL}/api/shares/${shareId}`, {
      method: 'DELETE',
      headers: {
        'X-Device-ID': deviceId,
      },
    });

    if (!response.ok) {
      logger.error('[ShareService] Failed to delete share:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[ShareService] Delete error:', error);
    throw error;
  }
}

export const shareService = {
  shareTask,
  deleteShare,
  createSnapshot,
};
