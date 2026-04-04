// src/stores/ralph-loop-store.ts
import { create } from 'zustand';
import { logger } from '@/lib/logger';
import { useSettingsStore } from '@/stores/settings-store';

interface RalphLoopState {
  isRalphLoopEnabled: boolean;
  initialize: () => void;
  toggleRalphLoop: () => void;
  setRalphLoop: (enabled: boolean) => void;
}

export const useRalphLoopStore = create<RalphLoopState>()((set, get) => ({
  isRalphLoopEnabled: false,

  initialize: () => {
    const settingsStore = useSettingsStore.getState();
    const isRalphLoopEnabled = settingsStore.getRalphLoopEnabled();

    logger.info('[RalphLoopStore] Initializing from settings', { isRalphLoopEnabled });

    set({ isRalphLoopEnabled });
  },

  toggleRalphLoop: () => {
    const currentState = get().isRalphLoopEnabled;
    const newState = !currentState;

    set({ isRalphLoopEnabled: newState });

    useSettingsStore
      .getState()
      .setRalphLoopEnabled(newState)
      .catch((error) => {
        logger.error('[RalphLoopStore] Failed to persist Ralph Loop state:', error);
      });
  },

  setRalphLoop: (enabled) => {
    logger.info('[RalphLoopStore] Setting Ralph Loop', { enabled });

    set({ isRalphLoopEnabled: enabled });

    useSettingsStore
      .getState()
      .setRalphLoopEnabled(enabled)
      .catch((error) => {
        logger.error('[RalphLoopStore] Failed to persist Ralph Loop state:', error);
      });
  },
}));
