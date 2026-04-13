import { create } from 'zustand';

export interface WorkspaceTab {
  id: string;
  projectId: string | null;
  projectName: string;
  rootPath: string | null;
}

interface WorkspaceTabsState {
  tabs: WorkspaceTab[];
  activeTabId: string;

  // Actions
  initializeFirstTab: (
    projectId: string | null,
    projectName: string,
    rootPath: string | null
  ) => void;
  addTab: () => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Omit<WorkspaceTab, 'id'>>) => void;
}

const MAX_TABS = 3;

let tabCounter = 0;

function generateTabId(): string {
  tabCounter += 1;
  return `workspace-tab-${tabCounter}`;
}

const initialTabId = generateTabId();

export const useWorkspaceTabsStore = create<WorkspaceTabsState>((set, get) => ({
  tabs: [
    {
      id: initialTabId,
      projectId: null,
      projectName: '',
      rootPath: null,
    },
  ],
  activeTabId: initialTabId,

  initializeFirstTab: (projectId, projectName, rootPath) => {
    const { tabs } = get();
    const firstTab = tabs[0];
    if (firstTab) {
      set({
        tabs: tabs.map((tab) =>
          tab.id === firstTab.id ? { ...tab, projectId, projectName, rootPath } : tab
        ),
      });
    }
  },

  addTab: () => {
    const { tabs } = get();
    if (tabs.length >= MAX_TABS) {
      const lastTab = tabs[tabs.length - 1];
      return lastTab ? lastTab.id : '';
    }

    const newId = generateTabId();
    const newTab: WorkspaceTab = {
      id: newId,
      projectId: null,
      projectName: '',
      rootPath: null,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: newId,
    });

    return newId;
  },

  removeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    // Don't remove if it's the only tab
    if (tabs.length <= 1) return;

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);

    // If we're removing the active tab, switch to an adjacent tab
    let newActiveId = activeTabId;
    if (activeTabId === tabId) {
      const newIndex = Math.min(tabIndex, newTabs.length - 1);
      const adjacentTab = newTabs[newIndex];
      newActiveId = adjacentTab ? adjacentTab.id : (newTabs[0]?.id ?? activeTabId);
    }

    set({
      tabs: newTabs,
      activeTabId: newActiveId,
    });
  },

  setActiveTab: (tabId) => {
    const { tabs } = get();
    if (tabs.some((t) => t.id === tabId)) {
      set({ activeTabId: tabId });
    }
  },

  updateTab: (tabId, updates) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab)),
    }));
  },
}));
