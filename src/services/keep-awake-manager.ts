// keep-awake-manager.ts - Orchestrates keep-awake state from execution store
//
// This manager subscribes to execution store updates and adjusts keep-awake
// ref counts outside of React, so keep-awake isn't tied to component lifecycle.

import { logger } from '@/lib/logger';
import { keepAwakeService } from '@/services/keep-awake-service';
import { useExecutionStore } from '@/stores/execution-store';

export type KeepAwakeSnapshot = {
  isPreventing: boolean;
  refCount: number;
  runningCount: number;
};

class KeepAwakeManager {
  private isStarted = false;
  private isInitialized = false;
  private runningCount = 0;
  private previousRunningCount = 0;
  private refCount = 0;
  private isPreventing = false;
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private operationQueue: Promise<void> = Promise.resolve();

  public start = (): void => {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;
    this.runningCount = useExecutionStore.getState().getRunningCount();
    this.previousRunningCount = this.runningCount;
    this.emit();

    this.unsubscribe = useExecutionStore.subscribe((state) => {
      const nextRunningCount = state.getRunningCount();
      if (nextRunningCount === this.runningCount) {
        return;
      }

      this.runningCount = nextRunningCount;
      this.emit();

      if (!this.isInitialized) {
        this.previousRunningCount = nextRunningCount;
        return;
      }

      const delta = nextRunningCount - this.previousRunningCount;
      this.previousRunningCount = nextRunningCount;
      this.enqueue(() => this.applyDelta(delta));
    });

    this.enqueue(() => this.syncToRunningCount());
  };

  public stop = (): void => {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.isStarted = false;
    this.isInitialized = false;
    this.runningCount = 0;
    this.previousRunningCount = 0;
    this.refCount = 0;
    this.isPreventing = false;
    this.operationQueue = Promise.resolve();
    this.emit();
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): KeepAwakeSnapshot => ({
    isPreventing: this.isPreventing,
    refCount: this.refCount,
    runningCount: this.runningCount,
  });

  public waitForIdle = (): Promise<void> => this.operationQueue;

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private setRefCount(count: number): void {
    const preventing = count > 0;
    const changed = count !== this.refCount || preventing !== this.isPreventing;
    this.refCount = count;
    this.isPreventing = preventing;

    if (changed) {
      this.emit();
    }
  }

  private enqueue(operation: () => Promise<void>): void {
    this.operationQueue = this.operationQueue.then(operation).catch((error) => {
      logger.error('[KeepAwakeManager] Operation failed:', error);
    });
  }

  private async syncToRunningCount(): Promise<void> {
    try {
      const count = await keepAwakeService.getRefCount();
      this.setRefCount(count);

      const targetCount = this.runningCount;
      this.previousRunningCount = targetCount;
      // Allow deltas while the initial sync is in flight.
      this.isInitialized = true;

      const delta = targetCount - count;
      if (delta !== 0) {
        await this.applyDelta(delta);
      }
    } catch (error) {
      logger.error('[KeepAwakeManager] Failed to sync keep-awake state:', error);
    }
  }

  private async applyDelta(delta: number): Promise<void> {
    if (delta === 0) {
      return;
    }

    const steps = Math.abs(delta);
    if (delta > 0) {
      for (let i = 0; i < steps; i += 1) {
        await keepAwakeService.acquire();
      }
    } else {
      for (let i = 0; i < steps; i += 1) {
        await keepAwakeService.release();
      }
    }

    const count = await keepAwakeService.getRefCount();
    this.setRefCount(count);
  }
}

export const keepAwakeManager = new KeepAwakeManager();

export function startKeepAwakeManager(): void {
  keepAwakeManager.start();
}
