import { create } from 'zustand';

export type UtilityTab = 'terminal' | 'browser';
export type BrowserSource = 'none' | 'url' | 'file';

interface BrowserState {
  isBrowserVisible: boolean;
  activeUtilityTab: UtilityTab;
  sourceType: BrowserSource;
  currentUrl: string;
  currentFilePath: string | null;
  currentContent: string | null;

  setBrowserVisible: (visible: boolean) => void;
  toggleBrowserVisible: () => void;
  setActiveUtilityTab: (tab: UtilityTab) => void;
  openBrowserUrl: (url: string) => void;
  openBrowserFile: (filePath: string, content: string | null) => void;
  setBrowserContent: (content: string | null) => void;
}

export const useBrowserStore = create<BrowserState>((set) => ({
  isBrowserVisible: false,
  activeUtilityTab: 'terminal',
  sourceType: 'none',
  currentUrl: '',
  currentFilePath: null,
  currentContent: null,

  setBrowserVisible: (visible) =>
    set((state) => ({
      isBrowserVisible: visible,
      activeUtilityTab: visible ? 'browser' : state.activeUtilityTab,
      sourceType: visible ? state.sourceType : state.sourceType,
    })),

  toggleBrowserVisible: () =>
    set((state) => ({
      isBrowserVisible: !state.isBrowserVisible,
      activeUtilityTab: !state.isBrowserVisible ? 'browser' : state.activeUtilityTab,
    })),

  setActiveUtilityTab: (tab) =>
    set((state) => ({
      activeUtilityTab: tab,
      isBrowserVisible: tab === 'browser' ? true : state.isBrowserVisible,
    })),

  openBrowserUrl: (url) =>
    set(() => ({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'url',
      currentUrl: url,
      currentFilePath: null,
      currentContent: null,
    })),

  openBrowserFile: (filePath, content) =>
    set(() => ({
      isBrowserVisible: true,
      activeUtilityTab: 'browser',
      sourceType: 'file',
      currentUrl: '',
      currentFilePath: filePath,
      currentContent: content,
    })),

  setBrowserContent: (content) =>
    set(() => ({
      currentContent: content,
    })),
}));
