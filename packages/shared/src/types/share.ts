// packages/shared/src/types/share.ts
// Share-related type definitions for TalkCody Task Share feature

/**
 * Share snapshot version for compatibility tracking
 */
export const SHARE_SNAPSHOT_VERSION = '1.0';

/**
 * Simplified message type for sharing (no Tauri dependencies)
 */
export interface ShareMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | ShareToolContent[];
  timestamp: number;
  attachments?: ShareAttachment[];
  nestedTools?: ShareMessage[];
}

/**
 * Tool content for shared messages
 */
export interface ShareToolContent {
  type: 'tool-call' | 'tool-result';
  toolCallId: string;
  toolName: string;
  summary?: string; // Pre-formatted summary for display
  input?: Record<string, unknown>;
  output?: unknown; // Sanitized output
}

/**
 * Attachment for shared messages (simplified, no local file paths)
 */
export interface ShareAttachment {
  id: string;
  type: 'image' | 'video' | 'file' | 'code';
  filename: string;
  mimeType: string;
  size: number;
  url?: string; // R2 storage URL for images/videos
  preview?: string; // Base64 preview for small images
}

/**
 * Task share snapshot - the complete data structure for a shared task
 */
export interface TaskShareSnapshot {
  version: string;
  task: {
    id: string;
    title: string;
    createdAt: number;
    messageCount: number;
    model?: string;
  };
  messages: ShareMessage[];
  metadata: {
    sharedAt: number;
    talkcodyVersion: string;
    platform: 'macos' | 'windows' | 'linux';
  };
}

/**
 * Request to create a new share
 */
export interface CreateShareRequest {
  snapshot: TaskShareSnapshot;
  options?: ShareOptions;
}

/**
 * Share options when creating a share
 */
export interface ShareOptions {
  /** Expiration period */
  expiresIn?: '1d' | '7d' | '30d' | 'never';
  /** Optional password protection */
  password?: string;
  /** Whether to include detailed tool outputs */
  includeToolDetails?: boolean;
}

/**
 * Response after creating a share
 */
export interface CreateShareResponse {
  shareId: string;
  shareUrl: string;
  expiresAt?: number;
}

/**
 * Task share record (stored in database)
 */
export interface TaskShare {
  id: string;
  taskId: string;
  userId?: string;
  taskTitle: string;
  snapshotData: TaskShareSnapshot;
  storageUrl?: string; // R2 URL for large shares
  model?: string;
  passwordHash?: string;
  expiresAt?: number;
  viewCount: number;
  isPublic: boolean;
  createdAt: number;
  createdBy?: string; // Device ID or user ID
}

/**
 * Share metadata for listing (without full snapshot)
 */
export interface ShareListItem {
  id: string;
  taskTitle: string;
  model?: string;
  messageCount: number;
  viewCount: number;
  expiresAt?: number;
  createdAt: number;
  hasPassword: boolean;
}

/**
 * Response when share requires password
 */
export interface SharePasswordRequired {
  requiresPassword: true;
  shareId: string;
}

/**
 * Response when share is expired or not found
 */
export interface ShareNotFound {
  error: 'not_found' | 'expired';
  message: string;
}

/**
 * Sensitive tools that should have filtered output in shares
 */
export const SENSITIVE_TOOLS = [
  'bash',
  'writeFile',
  'editFile',
  'deleteFile',
  'callAgent',
] as const;

export type SensitiveTool = (typeof SENSITIVE_TOOLS)[number];

/**
 * Check if a tool is sensitive
 */
export function isSensitiveTool(toolName: string): toolName is SensitiveTool {
  return SENSITIVE_TOOLS.includes(toolName as SensitiveTool);
}

/**
 * Expiration duration in milliseconds
 */
export const EXPIRATION_DURATIONS: Record<string, number> = {
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/**
 * Maximum share size in bytes (2MB)
 */
export const MAX_SHARE_SIZE = 2 * 1024 * 1024;

/**
 * Share base URL
 */
export const SHARE_BASE_URL = 'https://talkcody.com/share';
