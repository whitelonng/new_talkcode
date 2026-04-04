import { ArrowDown, ArrowUp } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import {
  formatCost,
  formatTokens,
  getContextUsageBgColor,
  getContextUsageColor,
  useToolbarState,
} from '@/hooks/use-toolbar-state';

/**
 * Toolbar stats component displaying model, cost/tokens, and context usage.
 * Uses container queries (@container) for responsive layout.
 * Parent container must have `@container` class for responsive breakpoints to work.
 */
export function ToolbarStats() {
  const t = useTranslation();
  const { modelName, cost, inputTokens, outputTokens, contextUsage } = useToolbarState();

  return (
    <>
      {modelName && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex min-w-0 flex-shrink items-center gap-1 rounded-md bg-blue-100 px-2 py-1 dark:bg-blue-900/30">
              <span className="hidden font-medium text-blue-700 text-xs @md:inline dark:text-blue-300">
                {t.Chat.toolbar.model}:
              </span>
              <span className="truncate font-medium text-blue-900 text-xs dark:text-blue-100">
                {modelName}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {t.Chat.toolbar.model}: {modelName}
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      {(cost > 0 || inputTokens > 0 || outputTokens > 0) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden flex-shrink items-center gap-1.5 overflow-hidden rounded-md bg-emerald-100 px-2 py-1 @xs:flex dark:bg-emerald-900/30">
              <span className="flex-shrink-0 font-medium text-emerald-700 text-xs dark:text-emerald-300">
                {formatCost(cost)}
              </span>
              <span className="hidden items-center text-emerald-600 text-xs @sm:flex dark:text-emerald-400">
                <ArrowUp className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {formatTokens(inputTokens)}
                  <span className="hidden @lg:inline"> {t.Chat.toolbar.inputTokens}</span>
                </span>
              </span>
              <span className="hidden items-center text-emerald-600 text-xs @sm:flex dark:text-emerald-400">
                <ArrowDown className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {formatTokens(outputTokens)}
                  <span className="hidden @lg:inline"> {t.Chat.toolbar.outputTokens}</span>
                </span>
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {formatCost(cost)} | {formatTokens(inputTokens)} {t.Chat.toolbar.inputTokens} |{' '}
              {formatTokens(outputTokens)} {t.Chat.toolbar.outputTokens}
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      {contextUsage > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 ${getContextUsageBgColor(contextUsage)}`}
            >
              <span
                className={`whitespace-nowrap font-medium text-xs ${getContextUsageColor(contextUsage)}`}
              >
                <span className="hidden @sm:inline">Context: </span>
                {contextUsage.toFixed(0)}%
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Context: {contextUsage.toFixed(0)}%</p>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
