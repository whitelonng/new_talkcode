import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { WindowManagerService } from '@/services/window-manager-service';
import { settingsManager } from '@/stores/settings-store';
import { type ShortcutAction, type ShortcutSettings, shortcutMatches } from '@/types/shortcuts';

export interface ShortcutHandlers {
  globalFileSearch?: () => void;
  globalContentSearch?: () => void;
  fileSearch?: () => void;
  saveFile?: () => void;
  newWindow?: () => void;
  openModelSettings?: () => void;
  toggleTerminal?: () => void;
  nextTerminalTab?: () => void;
  previousTerminalTab?: () => void;
  newTerminalTab?: () => void;
}

export function useGlobalShortcuts(handlers: ShortcutHandlers = {}) {
  const [shortcuts, setShortcuts] = useState<ShortcutSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load shortcuts from settings
  const loadShortcuts = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentShortcuts = await settingsManager.getAllShortcuts();
      setShortcuts(currentShortcuts);
      // logger.info('Loaded shortcuts:', currentShortcuts);
    } catch (error) {
      logger.error('Failed to load shortcuts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update shortcuts
  const updateShortcuts = useCallback(async (newShortcuts: ShortcutSettings) => {
    try {
      await settingsManager.setAllShortcuts(newShortcuts);
      setShortcuts(newShortcuts);
      logger.info('Updated shortcuts:', newShortcuts);
    } catch (error) {
      logger.error('Failed to update shortcuts:', error);
    }
  }, []);

  // Update a single shortcut
  const updateShortcut = useCallback(
    async (action: ShortcutAction, config: any) => {
      try {
        await settingsManager.setShortcutConfig(action, config);
        if (shortcuts) {
          const newShortcuts = { ...shortcuts, [action]: config };
          setShortcuts(newShortcuts);
        }
        logger.info(`Updated shortcut for ${action}:`, config);
      } catch (error) {
        logger.error(`Failed to update shortcut for ${action}:`, error);
      }
    },
    [shortcuts]
  );

  const handleNewWindow = useCallback(async () => {
    try {
      await WindowManagerService.createProjectWindow(undefined, undefined, true);
      toast.success('New window created');
    } catch (error) {
      logger.error('Failed to create new window:', error);
      toast.error('Failed to create new window');
    }
  }, []);

  // Reset to default shortcuts
  const resetToDefaults = useCallback(async () => {
    try {
      await settingsManager.resetShortcutsToDefault();
      await loadShortcuts();
      logger.info('Reset shortcuts to defaults');
    } catch (error) {
      logger.error('Failed to reset shortcuts:', error);
    }
  }, [loadShortcuts]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if shortcuts are not loaded yet
      if (!shortcuts) return;

      // Check for new window shortcut first (works everywhere, including input fields)
      if (shortcutMatches(event, shortcuts.newWindow)) {
        logger.info('New window shortcut triggered - creating new window');
        event.preventDefault();
        event.stopPropagation();
        if (handlers.newWindow) {
          handlers.newWindow();
        } else {
          handleNewWindow();
        }
        return;
      }

      // Check for open model settings shortcut (works everywhere, including input fields)
      if (shortcutMatches(event, shortcuts.openModelSettings)) {
        logger.info('Open model settings shortcut triggered');
        event.preventDefault();
        event.stopPropagation();
        if (handlers.openModelSettings) {
          handlers.openModelSettings();
        }
        return;
      }

      // Skip if user is typing in an input field
      const target = event.target as HTMLElement;
      // Use safe check for closest in case target doesn't have this method (e.g., in jsdom tests)
      const isInMonacoEditor =
        typeof target.closest === 'function' && !!target.closest('.monaco-editor');
      const isInXTermTerminal = typeof target.closest === 'function' && !!target.closest('.xterm');

      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        isInMonacoEditor ||
        isInXTermTerminal
      ) {
        // Allow save shortcut even in editor
        if (shortcutMatches(event, shortcuts.saveFile) && handlers.saveFile) {
          event.preventDefault();
          handlers.saveFile();
          return;
        }

        // Allow file search shortcut in editor
        if (shortcutMatches(event, shortcuts.fileSearch) && handlers.fileSearch) {
          event.preventDefault();
          handlers.fileSearch();
          return;
        }

        // Allow terminal tab switching shortcuts in XTerm terminal
        if (isInXTermTerminal) {
          if (shortcutMatches(event, shortcuts.nextTerminalTab) && handlers.nextTerminalTab) {
            event.preventDefault();
            handlers.nextTerminalTab();
            return;
          }

          if (
            shortcutMatches(event, shortcuts.previousTerminalTab) &&
            handlers.previousTerminalTab
          ) {
            event.preventDefault();
            handlers.previousTerminalTab();
            return;
          }

          if (shortcutMatches(event, shortcuts.newTerminalTab) && handlers.newTerminalTab) {
            event.preventDefault();
            handlers.newTerminalTab();
            return;
          }
        }

        // The following shortcuts are only allowed in Monaco Editor, not in regular input fields
        if (isInMonacoEditor) {
          // Allow global file search shortcut in editor
          if (shortcutMatches(event, shortcuts.globalFileSearch) && handlers.globalFileSearch) {
            event.preventDefault();
            event.stopPropagation();
            handlers.globalFileSearch();
            return;
          }

          // Allow global content search shortcut in editor
          if (
            shortcutMatches(event, shortcuts.globalContentSearch) &&
            handlers.globalContentSearch
          ) {
            event.preventDefault();
            event.stopPropagation();
            handlers.globalContentSearch();
            return;
          }

          // Allow toggle terminal shortcut in editor
          if (shortcutMatches(event, shortcuts.toggleTerminal) && handlers.toggleTerminal) {
            event.preventDefault();
            event.stopPropagation();
            logger.info('Triggering toggle terminal shortcut (in editor)', {
              timestamp: Date.now(),
              target: (event.target as HTMLElement)?.tagName,
            });
            handlers.toggleTerminal();
            return;
          }

          // Allow next terminal tab shortcut in editor
          if (shortcutMatches(event, shortcuts.nextTerminalTab) && handlers.nextTerminalTab) {
            event.preventDefault();
            event.stopPropagation();
            handlers.nextTerminalTab();
            return;
          }

          // Allow previous terminal tab shortcut in editor
          if (
            shortcutMatches(event, shortcuts.previousTerminalTab) &&
            handlers.previousTerminalTab
          ) {
            event.preventDefault();
            event.stopPropagation();
            handlers.previousTerminalTab();
            return;
          }

          // Allow new terminal tab shortcut in editor
          if (shortcutMatches(event, shortcuts.newTerminalTab) && handlers.newTerminalTab) {
            event.preventDefault();
            event.stopPropagation();
            handlers.newTerminalTab();
            return;
          }
        }

        // Skip other shortcuts when in input fields
        return;
      }

      // Check each shortcut
      if (shortcutMatches(event, shortcuts.globalFileSearch) && handlers.globalFileSearch) {
        event.preventDefault();
        event.stopPropagation();
        handlers.globalFileSearch();
        logger.debug('Triggered global file search shortcut');
      } else if (
        shortcutMatches(event, shortcuts.globalContentSearch) &&
        handlers.globalContentSearch
      ) {
        event.preventDefault();
        event.stopPropagation();
        handlers.globalContentSearch();
        logger.debug('Triggered global content search shortcut');
      } else if (shortcutMatches(event, shortcuts.fileSearch) && handlers.fileSearch) {
        event.preventDefault();
        event.stopPropagation();
        handlers.fileSearch();
        logger.debug('Triggered file search shortcut');
      } else if (shortcutMatches(event, shortcuts.saveFile) && handlers.saveFile) {
        event.preventDefault();
        event.stopPropagation();
        handlers.saveFile();
        logger.debug('Triggered save file shortcut');
      } else if (shortcutMatches(event, shortcuts.toggleTerminal) && handlers.toggleTerminal) {
        event.preventDefault();
        event.stopPropagation();
        logger.info('Triggering toggle terminal shortcut', {
          timestamp: Date.now(),
          target: (event.target as HTMLElement)?.tagName,
        });
        handlers.toggleTerminal();
      } else if (shortcutMatches(event, shortcuts.nextTerminalTab) && handlers.nextTerminalTab) {
        event.preventDefault();
        event.stopPropagation();
        handlers.nextTerminalTab();
      } else if (
        shortcutMatches(event, shortcuts.previousTerminalTab) &&
        handlers.previousTerminalTab
      ) {
        event.preventDefault();
        event.stopPropagation();
        handlers.previousTerminalTab();
      } else if (shortcutMatches(event, shortcuts.newTerminalTab) && handlers.newTerminalTab) {
        event.preventDefault();
        event.stopPropagation();
        handlers.newTerminalTab();
      }
    };

    // Use capture phase to handle shortcuts before other handlers
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [shortcuts, handlers, handleNewWindow]);

  // Load shortcuts on mount
  useEffect(() => {
    loadShortcuts();
  }, [loadShortcuts]);

  // Listen for settings updates
  useEffect(() => {
    const handleSettingsUpdate = () => {
      loadShortcuts();
    };

    window.addEventListener('shortcutsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('shortcutsUpdated', handleSettingsUpdate);
  }, [loadShortcuts]);

  return {
    shortcuts,
    isLoading,
    updateShortcuts,
    updateShortcut,
    resetToDefaults,
    loadShortcuts,
  };
}

// Hook for components that only need to read shortcuts
export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<ShortcutSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        setIsLoading(true);
        const currentShortcuts = await settingsManager.getAllShortcuts();
        setShortcuts(currentShortcuts);
      } catch (error) {
        logger.error('Failed to load shortcuts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadShortcuts();
  }, []);

  return { shortcuts, isLoading };
}
