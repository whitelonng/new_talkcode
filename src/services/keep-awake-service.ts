// keep-awake-service.ts - Service for preventing system sleep during task execution
//
// This service provides reference-counted sleep prevention to handle concurrent tasks:
// - Multiple tasks can request sleep prevention
// - Sleep is prevented while any task is active
// - Sleep is allowed when all tasks complete (refcount reaches 0)

import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { getLocale, type SupportedLocale } from '@/locales';

// Platform check - only enable on desktop platforms
const SUPPORTED_PLATFORMS = ['macos', 'windows', 'linux'];

/**
 * Keep awake service for preventing system sleep
 */
export class KeepAwakeService {
  private static instance: KeepAwakeService | null = null;
  private refCount = 0;
  private isPreventing = false;
  private currentPlatform: string | null = null;
  private platformDetected = false;

  private constructor() {
    // Platform is detected lazily when needed
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): KeepAwakeService {
    if (!KeepAwakeService.instance) {
      KeepAwakeService.instance = new KeepAwakeService();
    }
    return KeepAwakeService.instance;
  }

  /**
   * Detect the current platform
   */
  private async detectPlatform(): Promise<void> {
    if (this.platformDetected) {
      return;
    }
    try {
      this.currentPlatform = await platform();
      this.platformDetected = true;
      logger.info(`[KeepAwakeService] Platform detected: ${this.currentPlatform}`);
    } catch (error) {
      logger.error('[KeepAwakeService] Failed to detect platform:', error);
      this.currentPlatform = 'unknown';
      this.platformDetected = true;
    }
  }

  /**
   * Check if sleep prevention is supported on current platform
   */
  private async isSupported(): Promise<boolean> {
    await this.detectPlatform();
    return SUPPORTED_PLATFORMS.includes(this.currentPlatform || '');
  }

  /**
   * Get localized strings
   */
  private getTranslations() {
    const language = window.__LANGUAGE__ || 'en';
    return getLocale(language as SupportedLocale);
  }

  /**
   * Show toast notification
   */
  private showToast(type: 'success' | 'error', message: string) {
    toast(message, {
      duration: 3000,
      action:
        type === 'error'
          ? undefined
          : {
              label: 'Dismiss',
              onClick: () => {},
            },
    });
  }

  /**
   * Acquire sleep prevention (increment reference count)
   *
   * Returns true if sleep prevention was just enabled (first request)
   * Returns false if sleep prevention was already active
   */
  public async acquire(): Promise<boolean> {
    try {
      if (!(await this.isSupported())) {
        logger.warn('[KeepAwakeService] Platform not supported:', this.currentPlatform);
        return false;
      }

      // Call Rust backend to increment reference count
      const wasFirst = await invoke<boolean>('keep_awake_acquire');
      if (typeof wasFirst !== 'boolean') {
        throw new Error('Invalid keep_awake_acquire response');
      }

      // Update local state only after backend success
      this.refCount += 1;
      this.isPreventing = this.refCount > 0;
      if (wasFirst) {
        logger.info('[KeepAwakeService] Sleep prevention enabled', {
          refCount: this.refCount,
        });
      }

      return wasFirst;
    } catch (error) {
      const t = this.getTranslations().KeepAwake;
      logger.error('[KeepAwakeService] Failed to acquire sleep prevention:', error);
      this.showToast('error', t.error);
      return false;
    }
  }

  /**
   * Release sleep prevention (decrement reference count)
   *
   * Returns true if sleep prevention can now be disabled (last release)
   * Returns false if other tasks are still active
   */
  public async release(): Promise<boolean> {
    try {
      if (!(await this.isSupported())) {
        logger.warn('[KeepAwakeService] Platform not supported:', this.currentPlatform);
        return false;
      }

      // Call Rust backend to decrement reference count
      const wasLast = await invoke<boolean>('keep_awake_release');

      if (this.refCount > 0) {
        this.refCount -= 1;
      }

      this.isPreventing = this.refCount > 0;

      if (wasLast) {
        logger.info('[KeepAwakeService] Sleep prevention disabled', {
          refCount: this.refCount,
        });
      }

      return wasLast;
    } catch (error) {
      const t = this.getTranslations().KeepAwake;
      logger.error('[KeepAwakeService] Failed to release sleep prevention:', error);
      this.showToast('error', t.error);
      return false;
    }
  }

  /**
   * Get current reference count
   */
  public async getRefCount(): Promise<number> {
    try {
      if (!(await this.isSupported())) {
        return this.refCount;
      }
      const count = await invoke<number>('keep_awake_get_ref_count');
      this.refCount = count;
      this.isPreventing = count > 0;
      return count;
    } catch (error) {
      logger.error('[KeepAwakeService] Failed to get ref count:', error);
      return this.refCount;
    }
  }

  /**
   * Check if sleep is currently being prevented
   */
  public async isPreventingSleep(): Promise<boolean> {
    try {
      if (!(await this.isSupported())) {
        return false;
      }
      const preventing = await invoke<boolean>('keep_awake_is_preventing');
      this.isPreventing = preventing;
      return preventing;
    } catch (error) {
      logger.error('[KeepAwakeService] Failed to check if preventing sleep:', error);
      return this.isPreventing;
    }
  }

  /**
   * Force release all sleep prevention (for cleanup on app exit)
   */
  public async forceReleaseAll(): Promise<void> {
    try {
      if (!(await this.isSupported())) {
        return;
      }

      // Get current ref count
      const count = await this.getRefCount();

      // Release all references
      for (let i = 0; i < count; i++) {
        await this.release();
      }

      logger.info('[KeepAwakeService] Force released all sleep prevention', {
        count,
      });
    } catch (error) {
      logger.error('[KeepAwakeService] Failed to force release:', error);
    }
  }
}

// Export singleton instance
export const keepAwakeService = KeepAwakeService.getInstance();

// Convenience functions
export async function acquireSleepPrevention(): Promise<boolean> {
  return keepAwakeService.acquire();
}

export async function releaseSleepPrevention(): Promise<boolean> {
  return keepAwakeService.release();
}

export async function isPreventingSleep(): Promise<boolean> {
  return keepAwakeService.isPreventingSleep();
}

export async function getSleepPreventionRefCount(): Promise<number> {
  return keepAwakeService.getRefCount();
}

export async function forceReleaseAllSleepPrevention(): Promise<void> {
  return keepAwakeService.forceReleaseAll();
}
