import { generateId } from '@/lib/utils';
import { hookConfigService } from '@/services/hooks/hook-config-service';
import type { HookEventName, HookRunSummary } from '@/types/hooks';

export interface HookSessionState {
  sessionId: string;
  hooksEnabled: boolean;
  additionalContext: string[];
  stopHookActive: boolean;
}

export class HookStateService {
  private session: HookSessionState = {
    sessionId: generateId(),
    hooksEnabled: false,
    additionalContext: [],
    stopHookActive: false,
  };

  resetSession(): void {
    this.session = {
      sessionId: generateId(),
      hooksEnabled: false,
      additionalContext: [],
      stopHookActive: false,
    };
  }

  setHooksEnabled(enabled: boolean): void {
    this.session.hooksEnabled = enabled;
  }

  getSessionId(): string {
    return this.session.sessionId;
  }

  isHooksEnabled(): boolean {
    return this.session.hooksEnabled;
  }

  addContext(context: string | undefined): void {
    if (!context) return;
    this.session.additionalContext.push(context);
  }

  consumeAdditionalContext(): string[] {
    const context = [...this.session.additionalContext];
    this.session.additionalContext = [];
    return context;
  }

  setStopHookActive(active: boolean): void {
    this.session.stopHookActive = active;
  }

  isStopHookActive(): boolean {
    return this.session.stopHookActive;
  }

  async refreshConfigSnapshot(): Promise<void> {
    await hookConfigService.loadConfigs();
  }

  applyHookSummary(summary: HookRunSummary): void {
    if (summary.additionalContext.length > 0) {
      for (const context of summary.additionalContext) {
        this.addContext(context);
      }
    }
  }

  clearCache(): void {
    hookConfigService.clearCache();
  }

  shouldRunHooks(_event: HookEventName): boolean {
    return this.session.hooksEnabled;
  }
}

export const hookStateService = new HookStateService();
