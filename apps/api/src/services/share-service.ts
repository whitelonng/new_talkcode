// apps/api/src/services/share-service.ts
// Service for managing task shares

import type {
  CreateShareRequest,
  CreateShareResponse,
  ShareListItem,
  TaskShareSnapshot,
} from '@talkcody/shared/types/share';
import { EXPIRATION_DURATIONS, MAX_SHARE_SIZE } from '@talkcody/shared/types/share';
import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '../db/schema';
import { analyticsEvents, taskShares } from '../db/schema';

type Database = LibSQLDatabase<typeof schema>;

/**
 * Generate a short unique ID using Web Crypto API
 * Compatible with Cloudflare Workers
 */
function generateShareId(length = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (v) => chars[v % chars.length]).join('');
}

/**
 * Hash a password using SHA-256 (Web Crypto API)
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculate expiration timestamp based on duration string
 */
function calculateExpiresAt(expiresIn?: string): number | undefined {
  if (!expiresIn || expiresIn === 'never') {
    return undefined;
  }

  const duration = EXPIRATION_DURATIONS[expiresIn];
  return duration ? Date.now() + duration : undefined;
}

export class ShareService {
  constructor(private db: Database) {}

  /**
   * Create a new share
   */
  async createShare(
    request: CreateShareRequest,
    userId?: string,
    deviceId?: string
  ): Promise<CreateShareResponse> {
    const shareId = generateShareId(10);
    const now = Date.now();

    // Calculate expiration
    const expiresAt = calculateExpiresAt(request.options?.expiresIn);

    // Hash password if provided
    let passwordHash: string | undefined;
    if (request.options?.password) {
      passwordHash = await hashPassword(request.options.password);
    }

    // Serialize snapshot to JSON
    const messagesJson = JSON.stringify(request.snapshot);

    // Validate size (2MB limit)
    const sizeInBytes = new Blob([messagesJson]).size;
    if (sizeInBytes > MAX_SHARE_SIZE) {
      throw new Error(
        `Share size (${Math.round(sizeInBytes / 1024)} KB) exceeds maximum allowed size (${Math.round(MAX_SHARE_SIZE / 1024)} KB)`
      );
    }

    await this.db.insert(taskShares).values({
      id: shareId,
      taskId: request.snapshot.task.id,
      userId,
      taskTitle: request.snapshot.task.title,
      messagesJson,
      model: request.snapshot.task.model,
      passwordHash,
      expiresAt,
      viewCount: 0,
      isPublic: true,
      metadata: {
        talkcodyVersion: request.snapshot.metadata.talkcodyVersion,
        platform: request.snapshot.metadata.platform,
        sharedAt: request.snapshot.metadata.sharedAt,
      },
      createdAt: now,
      createdBy: deviceId,
    });

    const baseUrl = 'https://talkcody.com';

    return {
      shareId,
      shareUrl: `${baseUrl}/share/${shareId}`,
      expiresAt,
    };
  }

  /**
   * Get a share by ID
   * Returns null if not found or expired
   * Throws error if password required or invalid
   */
  async getShare(shareId: string, password?: string): Promise<TaskShareSnapshot | null> {
    const now = Date.now();

    const result = await this.db
      .select()
      .from(taskShares)
      .where(
        and(
          eq(taskShares.id, shareId),
          eq(taskShares.isPublic, true),
          or(isNull(taskShares.expiresAt), gt(taskShares.expiresAt, now))
        )
      )
      .limit(1);

    const share = result[0];
    if (!share) {
      return null;
    }

    // Verify password if required
    if (share.passwordHash) {
      if (!password) {
        throw new Error('PASSWORD_REQUIRED');
      }
      const inputHash = await hashPassword(password);
      if (inputHash !== share.passwordHash) {
        throw new Error('INVALID_PASSWORD');
      }
    }

    // Increment view count (fire-and-forget)
    this.db
      .update(taskShares)
      .set({ viewCount: share.viewCount + 1 })
      .where(eq(taskShares.id, shareId))
      .catch((error) => {
        // Log error but don't block the response
        console.error('[ShareService] Failed to increment view count for share:', shareId, error);
      });

    // Parse and return snapshot
    try {
      return JSON.parse(share.messagesJson) as TaskShareSnapshot;
    } catch {
      return null;
    }
  }

  /**
   * Check if a share requires password (without fetching full data)
   */
  async checkShareAccess(
    shareId: string
  ): Promise<{ exists: boolean; requiresPassword: boolean; expired: boolean }> {
    const now = Date.now();

    console.log('[ShareService] checkShareAccess called with shareId:', shareId);

    const result = await this.db
      .select({
        id: taskShares.id,
        passwordHash: taskShares.passwordHash,
        expiresAt: taskShares.expiresAt,
        isPublic: taskShares.isPublic,
      })
      .from(taskShares)
      .where(eq(taskShares.id, shareId))
      .limit(1);

    console.log('[ShareService] checkShareAccess result:', result);

    const share = result[0];
    if (!share || !share.isPublic) {
      console.log('[ShareService] Share not found or not public');
      return { exists: false, requiresPassword: false, expired: false };
    }

    const expired = share.expiresAt !== null && share.expiresAt < now;
    console.log('[ShareService] Share found, expired:', expired);
    return {
      exists: true,
      requiresPassword: !!share.passwordHash,
      expired,
    };
  }

  /**
   * Get shares created by a user
   */
  async getUserShares(userId: string): Promise<ShareListItem[]> {
    const result = await this.db
      .select({
        id: taskShares.id,
        taskTitle: taskShares.taskTitle,
        model: taskShares.model,
        viewCount: taskShares.viewCount,
        expiresAt: taskShares.expiresAt,
        createdAt: taskShares.createdAt,
        passwordHash: taskShares.passwordHash,
        messagesJson: taskShares.messagesJson,
      })
      .from(taskShares)
      .where(eq(taskShares.userId, userId))
      .orderBy(taskShares.createdAt);

    return result.map((share) => {
      let messageCount = 0;
      try {
        const snapshot = JSON.parse(share.messagesJson) as TaskShareSnapshot;
        messageCount = snapshot.messages?.length || 0;
      } catch {
        // Ignore parse errors
      }

      return {
        id: share.id,
        taskTitle: share.taskTitle,
        model: share.model ?? undefined,
        messageCount,
        viewCount: share.viewCount,
        expiresAt: share.expiresAt ?? undefined,
        createdAt: share.createdAt,
        hasPassword: !!share.passwordHash,
      };
    });
  }

  /**
   * Delete a share (only by owner)
   */
  async deleteShare(shareId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(taskShares)
      .where(and(eq(taskShares.id, shareId), eq(taskShares.userId, userId)));

    return result.rowsAffected > 0;
  }

  /**
   * Delete a share by ID (admin or device owner)
   */
  async deleteShareByDevice(shareId: string, deviceId: string): Promise<boolean> {
    const result = await this.db
      .delete(taskShares)
      .where(and(eq(taskShares.id, shareId), eq(taskShares.createdBy, deviceId)));

    return result.rowsAffected > 0;
  }

  /**
   * Cleanup expired shares
   * Should be called periodically (e.g., cron job)
   */
  async cleanupExpiredShares(): Promise<number> {
    const now = Date.now();
    const result = await this.db
      .delete(taskShares)
      .where(and(lt(taskShares.expiresAt, now), gt(taskShares.expiresAt, 0)));

    return result.rowsAffected;
  }

  /**
   * Verify device ID exists in analytics_events table
   * This ensures the request comes from a real TalkCody application
   */
  async verifyDeviceId(deviceId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.deviceId, deviceId))
        .limit(1);

      return (result[0]?.count || 0) > 0;
    } catch (error) {
      console.error('[ShareService] Failed to verify device ID:', error);
      return false;
    }
  }
}
