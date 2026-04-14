import { Bot, ChevronDown, FlaskConical, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLocale } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import { taskService } from '@/services/task-service';
import { useTaskStore } from '@/stores/task-store';
import { useWorktreeStore } from '@/stores/worktree-store';
import type { ExternalAgentBackend } from '@/types';

interface BackendSelectorButtonProps {
  taskId?: string | null;
}

const BACKEND_LABELS: Record<ExternalAgentBackend, string> = {
  native: 'TalkCody',
  codex: 'Codex',
  claude: 'Claude',
};

export function BackendSelectorButton({ taskId }: BackendSelectorButtonProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const currentTaskId = useTaskStore((state) => state.currentTaskId);
  const selectedNewTaskBackend = useTaskStore((state) => state.selectedNewTaskBackend);
  const effectiveTaskId = taskId ?? currentTaskId;
  const task = useTaskStore((state) =>
    effectiveTaskId ? state.getTask(effectiveTaskId) : undefined
  );
  const isTaskLocked = Boolean(task);
  const backend =
    (task?.backend as ExternalAgentBackend | undefined) ?? selectedNewTaskBackend ?? 'native';

  const description = useMemo(() => {
    switch (backend) {
      case 'codex':
        return '使用本地 Codex CLI 非交互模式';
      case 'claude':
        return '实验性 Claude Code 接入占位';
      default:
        return '使用 TalkCody 内置 Agent Runtime';
    }
  }, [backend]);

  const handleSelect = async (nextBackend: ExternalAgentBackend) => {
    if (nextBackend === 'codex') {
      useWorktreeStore.getState().setWorktreeMode(true);
    }

    if (isTaskLocked) {
      toast.info('任务创建后 Agent 类型已固定');
      setOpen(false);
      return;
    }

    if (isSaving || nextBackend === backend) {
      setOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      if (!effectiveTaskId) {
        useTaskStore.getState().setSelectedNewTaskBackend(nextBackend);
        toast.success(`新任务默认后端已切换到 ${BACKEND_LABELS[nextBackend]}`);
        setOpen(false);
        return;
      }

      await taskService.updateTaskBackend(effectiveTaskId, nextBackend);
      toast.success(`已切换到 ${BACKEND_LABELS[nextBackend]}`);
      setOpen(false);
    } catch (error) {
      logger.error('[BackendSelectorButton] Failed to update backend', error);
      toast.error('切换后端失败');
    } finally {
      setIsSaving(false);
    }
  };

  const items: Array<{
    backend: ExternalAgentBackend;
    title: string;
    desc: string;
    experimental?: boolean;
  }> = [
    {
      backend: 'native',
      title: 'TalkCody',
      desc: '默认内置代理循环与工具链',
    },
    {
      backend: 'codex',
      title: 'Codex',
      desc: '优先 MVP：通过 codex exec --json 跑通外部 runtime',
    },
    {
      backend: 'claude',
      title: 'Claude',
      desc: '预留 experimental 接入位，当前未真正执行',
      experimental: true,
    },
  ];

  return (
    <HoverCard>
      <Popover open={open} onOpenChange={setOpen}>
        <HoverCardTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={isSaving}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>{BACKEND_LABELS[backend]}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </PopoverTrigger>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-72">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{t?.Chat?.modelSelector?.title ?? 'Backend'}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </HoverCardContent>
        <PopoverContent side="top" align="start" className="w-80 p-2">
          <div className="space-y-1">
            {items.map((item) => {
              const selected = item.backend === backend;
              return (
                <button
                  key={item.backend}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent ${
                    selected ? 'bg-accent' : ''
                  }`}
                  onClick={() => handleSelect(item.backend)}
                >
                  <div className="mt-0.5 text-muted-foreground">
                    {item.experimental ? (
                      <FlaskConical className="h-4 w-4" />
                    ) : item.backend === 'codex' ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.title}</span>
                      {item.experimental && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          experimental
                        </span>
                      )}
                      {selected && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                    {isTaskLocked && selected && (
                      <p className="mt-1 text-[11px] text-muted-foreground">任务创建后不可切换</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </HoverCard>
  );
}
