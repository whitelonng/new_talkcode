import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const acquireSleepPrevention = vi.fn().mockResolvedValue(undefined);
  const releaseSleepPrevention = vi.fn().mockResolvedValue(undefined);
  const remoteChatServiceStart = vi.fn().mockResolvedValue(undefined);
  const remoteChatServiceStop = vi.fn().mockResolvedValue(undefined);
  const settingsManagerInitialize = vi.fn().mockResolvedValue(undefined);
  const useSettingsStore = Object.assign(vi.fn(), {
    getState: vi.fn(),
  });

  return {
    acquireSleepPrevention,
    releaseSleepPrevention,
    remoteChatServiceStart,
    remoteChatServiceStop,
    settingsManagerInitialize,
    useSettingsStore,
  };
});

vi.mock('@/services/keep-awake-service', () => ({
  acquireSleepPrevention: mocks.acquireSleepPrevention,
  releaseSleepPrevention: mocks.releaseSleepPrevention,
}));

vi.mock('@/services/remote/remote-chat-service', () => ({
  remoteChatService: {
    start: mocks.remoteChatServiceStart,
    stop: mocks.remoteChatServiceStop,
  },
}));

vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    initialize: mocks.settingsManagerInitialize,
  },
  useSettingsStore: mocks.useSettingsStore,
}));

import { remoteControlLifecycleService } from '@/services/remote/remote-control-lifecycle-service';

describe('remote-control-lifecycle-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const service = remoteControlLifecycleService as {
      isEnabled: boolean;
      keepAwakeActive: boolean;
    };
    service.isEnabled = false;
    service.keepAwakeActive = false;
  });

  it('acquires keep-awake only when remote control is enabled', async () => {
    mocks.useSettingsStore.getState.mockReturnValue({
      telegram_remote_enabled: true,
      feishu_remote_enabled: false,
      remote_control_keep_awake: true,
    });

    await remoteControlLifecycleService.initialize();

    expect(mocks.acquireSleepPrevention).toHaveBeenCalledTimes(1);
    expect(mocks.releaseSleepPrevention).not.toHaveBeenCalled();
    expect(mocks.remoteChatServiceStart).toHaveBeenCalledTimes(1);
  });

  it('releases keep-awake when remote control is disabled', async () => {
    const service = remoteControlLifecycleService as {
      keepAwakeActive: boolean;
    };
    service.keepAwakeActive = true;

    mocks.useSettingsStore.getState.mockReturnValue({
      telegram_remote_enabled: false,
      feishu_remote_enabled: false,
      remote_control_keep_awake: true,
    });

    await remoteControlLifecycleService.refresh();

    expect(mocks.acquireSleepPrevention).not.toHaveBeenCalled();
    expect(mocks.releaseSleepPrevention).toHaveBeenCalledTimes(1);
    expect(mocks.remoteChatServiceStop).toHaveBeenCalledTimes(1);
  });
});
