import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrent as getCurrentDeepLinkUrls, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CustomTitlebar } from '@/components/custom-titlebar';
import { InitializationScreen } from '@/components/initialization-screen';
import { LspDownloadPrompt } from '@/components/lsp-download-prompt';
import { MainContent } from '@/components/main-content';
import { OnboardingWizard } from '@/components/onboarding';
import { RemoteServiceRunner } from '@/components/remote/telegram-remote-runner';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { WhatsNewDialog } from '@/components/whats-new-dialog';
import { UiNavigationProvider, useUiNavigation } from '@/contexts/ui-navigation';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';
import { useWindowTitle } from '@/hooks/use-window-title';
import { logger } from '@/lib/logger';
import { initializationManager } from '@/services/initialization-manager';
import { useAuthStore } from '@/stores/auth-store';
import { useExecutionStore } from '@/stores/execution-store';
import { useProjectStore } from '@/stores/project-store';
import { useSettingsStore } from '@/stores/settings-store';
import {
  RepositoryStoreProvider,
  useWindowScopedRepositoryStore,
} from '@/stores/window-scoped-repository-store';
import { NavigationView } from '@/types/navigation';

function AppContent() {
  const { activeView, setActiveView } = useUiNavigation();
  const { t } = useLocale();
  const { handleOAuthCallback } = useAuthStore();

  // Initialize theme sync from database to localStorage
  useTheme();

  // Reactively keep the window title in sync with the selected project
  useWindowTitle();

  // Initialization state
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRunningTasksExitDialog, setShowRunningTasksExitDialog] = useState(false);
  const [runningTasksExitDialogCount, setRunningTasksExitDialogCount] = useState(0);
  const allowCloseRef = useRef(false);

  // Register global keyboard shortcuts
  useGlobalShortcuts({
    openModelSettings: useCallback(() => {
      setActiveView(NavigationView.SETTINGS);
      // Dispatch event to switch to models tab
      window.dispatchEvent(new CustomEvent('openModelSettingsTab'));
    }, [setActiveView]),
  });

  // Apply font size CSS variables
  const appFontSize = useSettingsStore((state) => state.app_font_size);
  const chatFontSize = useSettingsStore((state) => state.chat_font_size);
  const codeFontSize = useSettingsStore((state) => state.code_font_size);

  // Sync close-to-tray setting to Rust backend
  const closeToTray = useSettingsStore((state) => state.close_to_tray);
  const isInitialized = useSettingsStore((state) => state.isInitialized);
  const runningTaskCount = useExecutionStore((state) => state.getRunningTaskIds().length);
  const activeCloseBlockerCount = useExecutionStore(
    useCallback(
      (state) =>
        Array.from(state.executions.values()).filter(
          (execution) => execution.status === 'running' || execution.isStreaming
        ).length,
      []
    )
  );

  useEffect(() => {
    if (isInitialized) {
      invoke('set_close_to_tray', { enabled: closeToTray }).catch((err) => {
        logger.warn('Failed to sync close_to_tray to backend:', err);
      });
    }
  }, [closeToTray, isInitialized]);

  useEffect(() => {
    invoke('set_active_task_count', { count: activeCloseBlockerCount }).catch((err) => {
      logger.warn('Failed to sync active task count to backend:', err);
    });
  }, [activeCloseBlockerCount, closeToTray]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-font-size', `${appFontSize}px`);
    root.style.setProperty('--chat-font-size', `${chatFontSize}px`);
    root.style.setProperty('--code-font-size', `${codeFontSize}px`);
    root.style.fontSize = `${appFontSize}px`;
  }, [appFontSize, chatFontSize, codeFontSize]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupRunningTasksExitDialogListener = async () => {
      try {
        unlisten = await listen<{ count?: number }>('show-running-tasks-exit-dialog', (event) => {
          if (allowCloseRef.current) {
            return;
          }

          setRunningTasksExitDialogCount(event.payload?.count ?? activeCloseBlockerCount);
          setShowRunningTasksExitDialog(true);
        });
      } catch (error) {
        logger.error('Failed to listen for running tasks exit dialog event:', error);
      }
    };

    setupRunningTasksExitDialogListener();

    return () => {
      unlisten?.();
    };
  }, [activeCloseBlockerCount]);

  // Unified initialization on app startup - optimized for fast startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const startTime = performance.now();
        logger.info('Starting app initialization...');

        // Use initialization manager to handle critical store initialization
        // Non-critical services are loaded in background (non-blocking)
        await initializationManager.initialize();

        const initTime = performance.now() - startTime;
        logger.info(`App initialization completed in ${initTime.toFixed(0)}ms`);

        // Check if onboarding is needed
        const { onboarding_completed } = useSettingsStore.getState();
        if (!onboarding_completed) {
          setShowOnboarding(true);
        }

        setIsInitializing(false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('App initialization failed:', error);
        setInitError(`Failed to initialize: ${errorMessage}`);
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []); // Empty deps - initialization manager handles everything

  // Handle deep link URLs (OAuth callback)
  const handleDeepLinkUrl = useCallback(
    async (url: string) => {
      try {
        logger.info('[Deep Link] Processing deep link URL:', url);

        // Step 1: Activate the app to bring it to foreground (macOS specific)
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          logger.info('[Deep Link] Activating app...');
          await invoke('activate_app');
          logger.info('[Deep Link] App activated successfully');
        } catch (activateError) {
          logger.error('[Deep Link] Failed to activate app:', activateError);
        }

        // Step 2: Show and focus the window
        try {
          const window = getCurrentWindow();
          logger.info('[Deep Link] Showing and focusing window...');
          await window.show();
          await window.setFocus();
          logger.info('[Deep Link] Window shown and focused');
        } catch (windowError) {
          logger.error('[Deep Link] Failed to show/focus window:', windowError);
        }

        // Step 3: Parse URL and extract token
        logger.info('[Deep Link] Parsing URL...');
        const parsedUrl = new URL(url);
        logger.info('[Deep Link] URL pathname:', parsedUrl.pathname);
        logger.info('[Deep Link] URL search params:', parsedUrl.search);

        // Extract token from query params
        // Expected format: talkcody://auth/callback?token=xxx
        const token = parsedUrl.searchParams.get('token');

        if (token) {
          logger.info('[Deep Link] OAuth token received, length:', token.length);
          // Step 4: Process the OAuth callback
          await handleOAuthCallback(token);
          logger.info('[Deep Link] OAuth callback completed');
        } else {
          logger.error('[Deep Link] No token found in deep link URL');
          logger.error(
            '[Deep Link] No token found in URL. Available params:',
            Array.from(parsedUrl.searchParams.keys())
          );
        }
      } catch (error) {
        logger.error('[Deep Link] Failed to process deep link URL:', error);

        // Show error toast to user
        const { toast } = await import('sonner');
        toast.error('Failed to process sign-in callback');
      }
    },
    [handleOAuthCallback]
  );

  // Use ref to avoid stale closure in deep link listener
  // This ensures that listener always uses the latest handleDeepLinkUrl function
  const handleDeepLinkUrlRef = useRef(handleDeepLinkUrl);

  // Keep ref updated on every render
  useEffect(() => {
    handleDeepLinkUrlRef.current = handleDeepLinkUrl;
  }, [handleDeepLinkUrl]);

  // Listen for deep link events (OAuth callback)
  // Using ref pattern to avoid stale closures while keeping empty deps
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let isMounted = true;

    const setupDeepLink = async () => {
      try {
        logger.info('[Deep Link] Setting up deep link handler...');

        // Get initial URL (if app was launched via deep link)
        getCurrentDeepLinkUrls()
          .then((urls) => {
            if (!isMounted) return;
            logger.info('[Deep Link] Initial URLs:', urls);
            if (urls && urls.length > 0) {
              const firstUrl = urls[0];
              if (firstUrl) {
                // Use ref to get latest function
                handleDeepLinkUrlRef.current(firstUrl);
              }
            }
          })
          .catch((err) => {
            logger.error('[Deep Link] Failed to get initial URLs:', err);
          });

        // Listen for deep link events using official API
        const unlistenFn = await onOpenUrl((urls) => {
          try {
            logger.info('Deep link event received:', urls);

            if (urls && urls.length > 0) {
              const firstUrl = urls[0];
              if (firstUrl) {
                // Use ref to always get the latest function
                // This avoids stale closure issues
                handleDeepLinkUrlRef.current(firstUrl);
              }
            }
          } catch (error) {
            // Catch errors to prevent crashes in the listener
            logger.error('[Deep Link] Error in listener handler:', error);
          }
        });

        // Only set unlisten if component is still mounted
        if (isMounted) {
          unlisten = unlistenFn;
        } else {
          // Component unmounted before setup completed, clean up immediately
          unlistenFn?.();
        }
      } catch (error) {
        logger.error('[Deep Link] Setup failed:', error);
      }
    };

    setupDeepLink();

    // Cleanup function
    return () => {
      isMounted = false;
      if (unlisten) {
        unlisten();
      }
    };
    // Empty deps is safe now because we use ref pattern
  }, []);

  // MCP adapter is now lazy-loaded when first used
  // This saves ~1 second on startup by not connecting to MCP servers immediately
  // The multiMCPAdapter.getAdaptedTools() will call initialize() on first use

  // Store ref for dynamic dependencies to avoid infinite loops
  const repositoryDepsRef = useRef<{
    openRepository: (path: string, projectId: string) => Promise<void>;
    rootPath: string | null;
  }>({ openRepository: () => Promise.resolve(), rootPath: null });

  // Update ref when store changes
  const openRepository = useWindowScopedRepositoryStore((state) => state.openRepository);
  const rootPath = useWindowScopedRepositoryStore((state) => state.rootPath);

  // Update the ref on every render
  repositoryDepsRef.current = { openRepository, rootPath };

  // Track if we've already loaded the initial workspace project
  const projectLoadedRef = useRef(false);

  // Track when repository becomes ready (has a rootPath)
  const repositoryReadyRef = useRef(false);
  useEffect(() => {
    if (rootPath) {
      repositoryReadyRef.current = true;
    }
  }, [rootPath]);

  // Load the persisted workspace project once initialization completes.
  useEffect(() => {
    if (isInitializing) return;

    const loadInitialProject = async () => {
      if (projectLoadedRef.current || repositoryReadyRef.current) return;

      try {
        const projectId = useSettingsStore.getState().project;
        const { openRepository: repoOpenFn, rootPath: currentRootPath } = repositoryDepsRef.current;

        if (!projectId || projectId === 'default' || currentRootPath) {
          logger.info('[app.tsx] No persisted repository project to load');
          projectLoadedRef.current = true;
          return;
        }

        await useProjectStore.getState().refreshProjects();
        const project = useProjectStore.getState().projects.find((item) => item.id === projectId);

        if (project?.root_path) {
          logger.info('[app.tsx] Loading persisted project:', project.root_path);
          projectLoadedRef.current = true;
          await repoOpenFn(project.root_path, project.id);
          return;
        }

        logger.info('[app.tsx] Persisted project has no repository path, skipping repository load');
        projectLoadedRef.current = true;
      } catch (error) {
        logger.error('[app.tsx] Failed to load initial project:', error);
        projectLoadedRef.current = true;
      }
    };

    loadInitialProject();
  }, [isInitializing, rootPath]);

  // Handle dock menu project reveal/open inside the single main window.
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDockProjectListener = async () => {
      try {
        unlisten = await listen<string>('dock-open-project', async (event) => {
          const rootPathFromDock = event.payload;
          if (!rootPathFromDock) return;

          try {
            await useProjectStore.getState().refreshProjects();
            const matchedProject = useProjectStore
              .getState()
              .projects.find((project) => project.root_path === rootPathFromDock);

            if (matchedProject) {
              await repositoryDepsRef.current.openRepository(
                rootPathFromDock,
                matchedProject.id
              );
            } else {
              logger.warn('[app.tsx] Dock requested unknown project path:', rootPathFromDock);
            }
          } catch (error) {
            logger.error('[app.tsx] Failed to open project from dock menu:', error);
          }
        });
      } catch (error) {
        logger.error('[app.tsx] Failed to listen for dock-open-project:', error);
      }
    };

    setupDockProjectListener();

    return () => {
      unlisten?.();
    };
  }, []);

  // Save window state before closing
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // Workspace state is already persisted during repository switches.
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | undefined;

    const setupCloseRequestedHandler = async () => {
      try {
        unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
          if (allowCloseRef.current) {
            return;
          }

          if (activeCloseBlockerCount > 0) {
            event.preventDefault();
            if (isMounted) {
              setRunningTasksExitDialogCount(activeCloseBlockerCount);
              setShowRunningTasksExitDialog(true);
            }
            return;
          }

          if (closeToTray) {
            event.preventDefault();
            try {
              await getCurrentWindow().hide();
            } catch (error) {
              logger.error('Failed to hide main window to tray from frontend close handler:', error);
            }
          }
        });
      } catch (error) {
        logger.error('Failed to register close requested handler:', error);
      }
    };

    setupCloseRequestedHandler();

    return () => {
      isMounted = false;
      unlisten?.();
    };
  }, [activeCloseBlockerCount, closeToTray]);

  // Global drag/drop event handlers to prevent browser default behavior
  // This is required for Tauri's file-drop events to work properly
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Prevent default behavior on document level
    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', preventDefault);

    logger.info('Global drag/drop preventDefault handlers registered');

    return () => {
      document.removeEventListener('dragover', preventDefault);
      document.removeEventListener('drop', preventDefault);
      logger.info('Global drag/drop preventDefault handlers unregistered');
    };
  }, []);

  // Prevent Shift+Esc from triggering WebView2's browser task manager on Windows
  // This is a WebView2/Chromium built-in shortcut that cannot be disabled at the WebView level
  // We intercept it at the JavaScript level to prevent it from bubbling to the WebView
  useEffect(() => {
    const preventShiftEsc = (e: KeyboardEvent) => {
      // Check if it's Shift+Esc
      if (e.key === 'Escape' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        logger.debug('Prevented Shift+Esc browser task manager shortcut');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    // Use capture phase to intercept before any other handlers
    document.addEventListener('keydown', preventShiftEsc, true);

    logger.info('Global Shift+Esc preventDefault handler registered');

    return () => {
      document.removeEventListener('keydown', preventShiftEsc, true);
      logger.info('Global Shift+Esc preventDefault handler unregistered');
    };
  }, []);

  const handleConfirmExitWithRunningTasks = useCallback(async () => {
    try {
      allowCloseRef.current = true;
      await invoke('set_force_exit_on_close', { enabled: true });
      setShowRunningTasksExitDialog(false);
      await getCurrentWindow().close();
    } catch (error) {
      allowCloseRef.current = false;
      logger.error('Failed to close app after running task confirmation:', error);
    }
  }, []);

  const handleCancelExitWithRunningTasks = useCallback(() => {
    allowCloseRef.current = false;
    setShowRunningTasksExitDialog(false);
    setRunningTasksExitDialogCount(0);
  }, []);

  // Show initialization screen while loading or if there's an error
  if (isInitializing || initError) {
    return <InitializationScreen error={initError} />;
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Custom Titlebar */}
      <CustomTitlebar />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <MainContent activeView={activeView} />
      </div>

      <AlertDialog open={showRunningTasksExitDialog} onOpenChange={setShowRunningTasksExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.App.runningTasksExitTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.App.runningTasksExitDescription(
                runningTasksExitDialogCount || activeCloseBlockerCount || runningTaskCount
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExitWithRunningTasks}>
              {t.Common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExitWithRunningTasks}>
              {t.App.confirmExit}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toast Notifications */}
      <RemoteServiceRunner />
      <Toaster richColors />

      {/* What's New Dialog - shown after app update */}
      <WhatsNewDialog />

      {/* LSP Server Download Prompt */}
      <LspDownloadPrompt />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <RepositoryStoreProvider>
        <UiNavigationProvider>
          <AppContent />
        </UiNavigationProvider>
      </RepositoryStoreProvider>
    </ThemeProvider>
  );
}

export default App;
