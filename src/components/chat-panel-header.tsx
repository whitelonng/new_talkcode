import { Settings, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUiNavigation } from '@/contexts/ui-navigation';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';
import type { UIMessage } from '@/types/agent';
import { NavigationView } from '@/types/navigation';

import { ShareTaskDialog } from './task/share-task-dialog';
import { ToolbarStats } from './toolbar-stats';

interface ChatPanelHeaderProps {
  currentTask?: Task;
  messages?: UIMessage[];
}

export function ChatPanelHeader({ currentTask, messages = [] }: ChatPanelHeaderProps) {
  const t = useTranslation();
  const { isAppleTheme } = useTheme();
  const { setActiveView } = useUiNavigation();
  const canShare = currentTask && messages.length > 0;

  return (
    <div
      className={cn(
        '@container flex flex-shrink-0 items-center justify-between gap-2 overflow-hidden border-b px-3',
        isAppleTheme
          ? 'h-[46px] border-white/10 bg-black/20 backdrop-blur-xl dark:bg-white/5'
          : 'h-[42px] bg-gray-50 dark:bg-gray-900'
      )}
    >
      {/* Left: Model, Cost/Tokens, Context */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <ToolbarStats />
      </div>

      {/* Right: Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {/* Share Button */}
        {canShare && (
          <ShareTaskDialog
            task={currentTask}
            messages={messages}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'p-0',
                  isAppleTheme
                    ? 'h-7 w-7 rounded-full hover:bg-white/10 dark:hover:bg-white/10'
                    : 'h-6 w-6 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
                onClick={() => {}}
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            }
          />
        )}

        {/* Settings Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'p-0',
                isAppleTheme
                  ? 'h-7 w-7 rounded-full hover:bg-white/10 dark:hover:bg-white/10'
                  : 'h-6 w-6 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              onClick={() => setActiveView(NavigationView.SETTINGS)}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t.Navigation.settingsTooltip}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
