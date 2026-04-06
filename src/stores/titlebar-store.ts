import { create } from 'zustand';

interface TitlebarState {
  hasRepository: boolean;
  isTerminalVisible: boolean;
  isBrowserVisible: boolean;
  isChatFullscreen: boolean;

  // Layout actions registered by RepositoryLayout
  toggleTerminal: (() => void) | null;
  toggleBrowser: (() => void) | null;
  toggleChatFullscreen: (() => void) | null;

  // Setters
  setHasRepository: (hasRepo: boolean) => void;
  setTerminalVisible: (visible: boolean) => void;
  setBrowserVisible: (visible: boolean) => void;
  setChatFullscreen: (fullscreen: boolean) => void;

  // Registration
  registerLayoutActions: (actions: {
    toggleTerminal: () => void;
    toggleBrowser: () => void;
    toggleChatFullscreen: () => void;
  }) => void;
  unregisterLayoutActions: () => void;
}

export const useTitlebarStore = create<TitlebarState>((set) => ({
  hasRepository: false,
  isTerminalVisible: false,
  isBrowserVisible: false,
  isChatFullscreen: false,

  toggleTerminal: null,
  toggleBrowser: null,
  toggleChatFullscreen: null,

  setHasRepository: (hasRepo) => set({ hasRepository: hasRepo }),
  setTerminalVisible: (visible) => set({ isTerminalVisible: visible }),
  setBrowserVisible: (visible) => set({ isBrowserVisible: visible }),
  setChatFullscreen: (fullscreen) => set({ isChatFullscreen: fullscreen }),

  registerLayoutActions: (actions) =>
    set({
      toggleTerminal: actions.toggleTerminal,
      toggleBrowser: actions.toggleBrowser,
      toggleChatFullscreen: actions.toggleChatFullscreen,
    }),

  unregisterLayoutActions: () =>
    set({
      toggleTerminal: null,
      toggleBrowser: null,
      toggleChatFullscreen: null,
    }),
}));
