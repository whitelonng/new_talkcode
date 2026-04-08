import { getCurrentWindow } from '@tauri-apps/api/window';
import { type as getOsType } from '@tauri-apps/plugin-os';
import {
  Activity,
  ArrowLeft,
  Bot,
  Clock,
  Files,
  FolderOpen,
  Globe,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Server,
  Settings,
  Square,
  SquareTerminal,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUiNavigation } from '@/contexts/ui-navigation';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { useTitlebarStore } from '@/stores/titlebar-store';
import { NavigationView } from '@/types/navigation';
import talkCodyIcon from '../../src-tauri/icons/128x128.png';

export function CustomTitlebar() {
  const { t } = useLocale();
  const { theme, resolvedTheme, isAppleTheme, setTheme } = useTheme();
  const [osType, setOsType] = useState<string>('windows');
  const [isMaximized, setIsMaximized] = useState(false);
  const { activeView, setActiveView } = useUiNavigation();

  const {
    hasRepository,
    isTerminalVisible,
    isBrowserVisible,
    isChatFullscreen,
    toggleTerminal,
    toggleBrowser,
    toggleChatFullscreen,
  } = useTitlebarStore();

  useEffect(() => {
    setOsType(getOsType());

    const initMaximizeState = async () => {
      const isMax = await getCurrentWindow().isMaximized();
      setIsMaximized(isMax);
    };
    initMaximizeState();

    const unlisten = getCurrentWindow().onResized(async () => {
      const isMax = await getCurrentWindow().isMaximized();
      setIsMaximized(isMax);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  const isMac = osType === 'macos';

  const menuItems = [
    { id: NavigationView.EXPLORER, icon: Files, label: t.Navigation.explorerTooltip },
    { id: NavigationView.PROJECTS, icon: FolderOpen, label: t.Navigation.projectsTooltip },
    { id: NavigationView.AGENTS_MARKETPLACE, icon: Bot, label: t.Navigation.agentsTooltip },
    { id: NavigationView.SKILLS_MARKETPLACE, icon: Zap, label: t.Navigation.skillsTooltip },
    { id: NavigationView.MCP_SERVERS, icon: Server, label: t.Navigation.mcpServersTooltip },
    { id: NavigationView.SCHEDULED_TASKS, icon: Clock, label: t.Navigation.scheduledTasksTooltip },
    { id: NavigationView.USAGE, icon: Activity, label: t.Navigation.usageTooltip },
  ];

  const isNonExplorerView = activeView !== NavigationView.EXPLORER;

  const WindowControls = () => (
    <div className={cn('flex h-full', isMac ? 'flex-row-reverse' : 'flex-row')}>
      <button
        type="button"
        className="flex h-full w-12 cursor-pointer items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
        onClick={handleMinimize}
        title={t.Titlebar.minimize}
      >
        <Minus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      </button>
      <button
        type="button"
        className="flex h-full w-12 cursor-pointer items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
        onClick={handleMaximize}
        title={isMaximized ? t.Titlebar.restore : t.Titlebar.maximize}
      >
        {isMaximized ? (
          <div className="relative h-3 w-3 border-t-2 border-r-2 border-gray-600 dark:border-gray-400">
            <div className="absolute top-1 right-1 h-3 w-3 border-2 border-gray-600 dark:border-gray-400" />
          </div>
        ) : (
          <Square className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
        )}
      </button>
      <button
        type="button"
        className="flex h-full w-12 cursor-pointer items-center justify-center hover:bg-red-500 hover:text-white"
        onClick={handleClose}
        title={t.Titlebar.close}
      >
        <X className="h-4 w-4 text-gray-600 dark:text-gray-400 hover:text-white" />
      </button>
    </div>
  );

  return (
    <div
      className={cn(
        'flex h-10 w-full select-none items-center justify-between border-b',
        isAppleTheme
          ? 'border-white/10 bg-black/30 backdrop-blur-2xl'
          : 'bg-gray-50/90 backdrop-blur dark:bg-gray-900/90'
      )}
    >
      <div className="flex h-full items-center pl-2">
        {isMac && <WindowControls />}

        <div className="flex items-center gap-2 px-3" data-tauri-drag-region>
          <div className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-white dark:bg-white/90 shadow-sm pointer-events-none">
            <img src={talkCodyIcon} alt="TalkCody" className="h-4 w-4" />
          </div>
          <span className="pointer-events-none text-sm font-semibold" data-tauri-drag-region>
            TalkCody
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2" title={t.Titlebar.functionMenu}>
              <LayoutGrid className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={activeView === item.id ? 'bg-accent' : ''}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setActiveView(NavigationView.SETTINGS)}
              className={activeView === NavigationView.SETTINGS ? 'bg-accent' : ''}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>{t.Navigation.settingsTooltip}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-1 h-7 w-7 p-0">
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <Moon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
              <DropdownMenuRadioItem value="light">Default Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Default Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">Default System</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value="apple-light">Apple Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="apple-dark">Apple Dark</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {isNonExplorerView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 ml-1"
                onClick={() => setActiveView(NavigationView.EXPLORER)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t.Titlebar.backToExplorer}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="h-full flex-1" data-tauri-drag-region />

      <div className="flex h-full items-center">
        {hasRepository && (
          <div className="flex items-center gap-1 pr-2">
            {toggleTerminal && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 w-7 p-0',
                      isTerminalVisible && 'bg-gray-200 dark:bg-gray-800'
                    )}
                    onClick={toggleTerminal}
                  >
                    <SquareTerminal className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t.Titlebar.terminal}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {toggleBrowser && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 w-7 p-0',
                      isBrowserVisible && 'bg-gray-200 dark:bg-gray-800'
                    )}
                    onClick={toggleBrowser}
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t.Titlebar.browser}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {toggleChatFullscreen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={toggleChatFullscreen}
                  >
                    {isChatFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{isChatFullscreen ? t.Titlebar.exitFullscreen : t.Titlebar.fullscreen}</p>
                </TooltipContent>
              </Tooltip>
            )}

            <div className="ml-1 h-4 w-px bg-gray-300 dark:bg-gray-700" />
          </div>
        )}

        {!isMac && <WindowControls />}
      </div>
    </div>
  );
}
