import { logger } from '@/lib/logger';
import { acquireSleepPrevention, releaseSleepPrevention } from '@/services/keep-awake-service';
import { remoteChatService } from '@/services/remote/remote-chat-service';
import { settingsManager, useSettingsStore } from '@/stores/settings-store';

class RemoteControlLifecycleService {
  private static instance: RemoteControlLifecycleService | null = null;
  private isEnabled = false;
  private keepAwakeActive = false;
  private lastEnabledChannels = {
    telegram: false,
    feishu: false,
  };

  private constructor() {}

  static getInstance(): RemoteControlLifecycleService {
    if (!RemoteControlLifecycleService.instance) {
      RemoteControlLifecycleService.instance = new RemoteControlLifecycleService();
    }
    return RemoteControlLifecycleService.instance;
  }

  async initialize(): Promise<void> {
    try {
      await settingsManager.initialize();
      const state = useSettingsStore.getState();
      const enabledChannels = this.getEnabledChannels(state);
      this.isEnabled = enabledChannels.any;
      this.lastEnabledChannels = enabledChannels.state;
      await this.applyKeepAwake(this.isEnabled && state.remote_control_keep_awake);

      if (this.isEnabled) {
        await remoteChatService.start();
      }
    } catch (error) {
      logger.warn('[RemoteControlLifecycle] Failed to initialize', error);
    }
  }

  async refresh(): Promise<void> {
    const state = useSettingsStore.getState();
    const enabledChannels = this.getEnabledChannels(state);
    const shouldRun = enabledChannels.any;

    await this.applyKeepAwake(shouldRun && state.remote_control_keep_awake);

    if (shouldRun) {
      if (!this.isEnabled || this.hasChannelChange(enabledChannels.state)) {
        await remoteChatService.refresh();
      } else {
        await remoteChatService.start();
      }
    } else {
      await remoteChatService.stop();
    }

    this.isEnabled = shouldRun;
    this.lastEnabledChannels = enabledChannels.state;
  }

  async shutdown(): Promise<void> {
    await remoteChatService.stop();
    if (this.keepAwakeActive) {
      await releaseSleepPrevention();
      this.keepAwakeActive = false;
    }
  }

  private getEnabledChannels(state: ReturnType<typeof useSettingsStore.getState>): {
    any: boolean;
    state: { telegram: boolean; feishu: boolean };
  } {
    const enabled = {
      telegram: state.telegram_remote_enabled,
      feishu: state.feishu_remote_enabled,
    };
    return { any: enabled.telegram || enabled.feishu, state: enabled };
  }

  private hasChannelChange(next: { telegram: boolean; feishu: boolean }): boolean {
    return (
      this.lastEnabledChannels.telegram !== next.telegram ||
      this.lastEnabledChannels.feishu !== next.feishu
    );
  }

  private async applyKeepAwake(enabled: boolean): Promise<void> {
    if (enabled && !this.keepAwakeActive) {
      await acquireSleepPrevention();
      this.keepAwakeActive = true;
      return;
    }

    if (!enabled && this.keepAwakeActive) {
      await releaseSleepPrevention();
      this.keepAwakeActive = false;
    }
  }
}

export const remoteControlLifecycleService = RemoteControlLifecycleService.getInstance();
