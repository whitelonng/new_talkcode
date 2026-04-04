import { useCallback, useMemo, useState } from 'react';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useTask } from '@/hooks/use-task';
import { useWorktreeConflict } from '@/hooks/use-worktree-conflict';
import { logger } from '@/lib/logger';
import { taskService } from '@/services/task-service';
import { terminalService } from '@/services/terminal-service';
import type { UtilityTab } from '@/stores/browser-store';
import type { OpenFile } from '@/types/file-system';
import type { SidebarView } from '@/types/navigation';
import { DEFAULT_FULLSCREEN_PANEL, DEFAULT_SIDEBAR_VIEW, DEFAULT_UTILITY_TAB } from './constants';
import type { FullscreenPanel } from './types';

export function useRepositoryLayoutUI() {
  // UI-related local state
  const [sidebarView, setSidebarView] = useState<SidebarView>(DEFAULT_SIDEBAR_VIEW);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isContentSearchVisible, setIsContentSearchVisible] = useState(false);
  const [fullscreenPanel, setFullscreenPanel] = useState<FullscreenPanel>(DEFAULT_FULLSCREEN_PANEL);
  const [activeUtilityTab, setActiveUtilityTab] = useState<UtilityTab>(DEFAULT_UTILITY_TAB);
  const [failedPaths] = useState(() => new Set<string>());

  // Fullscreen panel toggle
  const toggleFullscreen = useCallback((panel: 'editor' | 'terminal' | 'chat') => {
    setFullscreenPanel((prev) => (prev === panel ? 'none' : panel));
  }, []);

  return {
    // UI state
    sidebarView,
    setSidebarView,
    isHistoryOpen,
    setIsHistoryOpen,
    isContentSearchVisible,
    setIsContentSearchVisible,
    fullscreenPanel,
    setFullscreenPanel,
    activeUtilityTab,
    setActiveUtilityTab,
    toggleFullscreen,
    failedPaths,
  };
}

export function useRepositoryLayoutDerived(state: {
  hasRepository: boolean;
  isDefaultProject: boolean;
  openFiles: OpenFile[];
  fullscreenPanel: FullscreenPanel;
  isTerminalVisible: boolean;
  isBrowserVisible: boolean;
  activeUtilityTab: UtilityTab;
  lintSettings: { enabled: boolean; showInProblemsPanel: boolean };
}) {
  // Derived state calculation
  const derivedState = useMemo(
    () => ({
      shouldShowSidebar: state.hasRepository || state.isDefaultProject,
      hasOpenFiles: state.openFiles.length > 0,
      showFileTree: state.fullscreenPanel === 'none',
      showMiddlePanel:
        state.fullscreenPanel === 'none' ||
        state.fullscreenPanel === 'editor' ||
        state.fullscreenPanel === 'terminal',
      showChatPanel: state.fullscreenPanel === 'none' || state.fullscreenPanel === 'chat',
      showEditor: state.fullscreenPanel !== 'terminal' && state.fullscreenPanel !== 'chat',
      showUtilityPanel:
        (state.isTerminalVisible || state.isBrowserVisible) &&
        state.fullscreenPanel !== 'editor' &&
        state.fullscreenPanel !== 'chat',
      showTerminal:
        state.isTerminalVisible &&
        state.activeUtilityTab === 'terminal' &&
        state.fullscreenPanel !== 'editor' &&
        state.fullscreenPanel !== 'chat',
      showBrowser:
        state.isBrowserVisible &&
        state.activeUtilityTab === 'browser' &&
        state.fullscreenPanel !== 'editor' &&
        state.fullscreenPanel !== 'chat',
      showProblemsPanel:
        state.lintSettings.enabled &&
        state.lintSettings.showInProblemsPanel &&
        state.openFiles.length > 0 &&
        state.fullscreenPanel === 'none',
      isEditorFullscreen: state.fullscreenPanel === 'editor',
      isTerminalFullscreen: state.fullscreenPanel === 'terminal',
      isChatFullscreen: state.fullscreenPanel === 'chat',
    }),
    [
      state.hasRepository,
      state.isDefaultProject,
      state.openFiles.length,
      state.fullscreenPanel,
      state.isTerminalVisible,
      state.isBrowserVisible,
      state.activeUtilityTab,
      state.lintSettings.enabled,
      state.lintSettings.showInProblemsPanel,
    ]
  );

  return derivedState;
}

// Dedicated hook: for handling worktree conflicts
export function useRepositoryWorktree() {
  const {
    conflictData,
    isProcessing: isWorktreeProcessing,
    mergeResult,
    syncResult,
    checkForConflicts,
    discardChanges,
    mergeToMain,
    syncFromMain,
    cancelOperation,
    resetState: resetWorktreeState,
  } = useWorktreeConflict();

  return {
    conflictData,
    isWorktreeProcessing,
    mergeResult,
    syncResult,
    checkForConflicts,
    discardChanges,
    mergeToMain,
    syncFromMain,
    cancelOperation,
    resetWorktreeState,
  };
}

// Dedicated hook: for handling task-related logic
export function useRepositoryTasks(currentTaskId: string | null) {
  const { task: currentTask, messages: currentMessages } = useTask(currentTaskId);

  const handleNewChat = useCallback(async () => {
    taskService.startNewTask();
  }, []);

  const handleHistoryTaskSelect = useCallback((taskId: string) => {
    taskService.selectTask(taskId);
  }, []);

  const handleTaskStart = useCallback((taskId: string, _title: string) => {
    taskService.selectTask(taskId);
  }, []);

  return {
    currentTask,
    currentMessages,
    handleNewChat,
    handleHistoryTaskSelect,
    handleTaskStart,
  };
}

// Dedicated hook: for handling global shortcuts
export function useRepositoryShortcuts(
  openFileSearch: () => void,
  setTerminalVisible: (visible: boolean) => void,
  selectNextSession: () => void,
  selectPreviousSession: () => void,
  rootPath: string | null,
  setIsContentSearchVisible: (visible: boolean | ((prev: boolean) => boolean)) => void,
  isTerminalVisible: boolean,
  setActiveUtilityTab: (tab: UtilityTab) => void
) {
  useGlobalShortcuts({
    globalFileSearch: () => {
      openFileSearch();
    },
    globalContentSearch: () => {
      setIsContentSearchVisible((prev) => !prev);
    },
    saveFile: () => {
      // TODO: Implement save functionality
      logger.debug('Save file shortcut triggered');
    },
    fileSearch: () => {
      // TODO: Implement file search in editor
      logger.debug('File search shortcut triggered');
    },
    toggleTerminal: () => {
      const nextVisible = !isTerminalVisible;
      setTerminalVisible(nextVisible);
      if (nextVisible) {
        setActiveUtilityTab('terminal');
      }
    },
    nextTerminalTab: () => {
      if (isTerminalVisible) {
        selectNextSession();
      }
    },
    previousTerminalTab: () => {
      if (isTerminalVisible) {
        selectPreviousSession();
      }
    },
    newTerminalTab: async () => {
      if (isTerminalVisible && rootPath) {
        setActiveUtilityTab('terminal');
        await terminalService.createTerminal(rootPath);
      }
    },
  });
}
