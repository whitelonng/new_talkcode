import { Maximize2, Minimize2, Plus, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { useExecutionStore } from '@/stores/execution-store';
import type { Task } from '@/types';
import type { UIMessage } from '@/types/agent';

import { ShareTaskDialog } from './task/share-task-dialog';
import { ToolbarStats } from './toolbar-stats';

interface ChatPanelHeaderProps {
  currentTask?: Task;
  messages?: UIMessage[];
  onNewChat: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function ChatPanelHeader({
  currentTask,
  messages = [],
  onNewChat,
  isFullscreen,
  onToggleFullscreen,
}: ChatPanelHeaderProps) {
  const t = useTranslation();
  const isMaxReached = useExecutionStore((state) => state.isMaxReached());
  const canShare = currentTask && messages.length > 0;

  return (
    <div className="@container flex h-[42px] flex-shrink-0 items-center justify-between gap-2 overflow-hidden border-b bg-gray-50 px-3 dark:bg-gray-900">
      {/* Left: Model, Cost/Tokens, Context */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <ToolbarStats />
      </div>

      {/* Right: Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
              disabled={isMaxReached}
              onClick={onNewChat}
              size="sm"
              title={isMaxReached ? 'Maximum concurrent tasks reached' : undefined}
              variant="ghost"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t.Chat.newChat}</p>
          </TooltipContent>
        </Tooltip>

        {/* Share Button */}
        {canShare && (
          <ShareTaskDialog
            task={currentTask}
            messages={messages}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => {}}
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            }
          />
        )}

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={onToggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
