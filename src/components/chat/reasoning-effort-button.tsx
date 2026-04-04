// src/components/chat/reasoning-effort-button.tsx

import { Brain, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';

// Reasoning effort levels
const REASONING_EFFORT_LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'X-High' },
] as const;

export type ReasoningEffort = (typeof REASONING_EFFORT_LEVELS)[number]['value'];

export function ReasoningEffortButton() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  // Get current reasoning effort setting
  const reasoningEffort = useSettingsStore((state) => state.reasoning_effort);
  const setReasoningEffort = useSettingsStore((state) => state.setReasoningEffort);

  // Get current effort info
  const currentEffort = useMemo(() => {
    return (
      REASONING_EFFORT_LEVELS.find((level) => level.value === reasoningEffort) ||
      REASONING_EFFORT_LEVELS.find((level) => level.value === 'medium')
    );
  }, [reasoningEffort]);

  // Handle effort selection
  const handleSelectEffort = async (effort: ReasoningEffort) => {
    try {
      await setReasoningEffort(effort);
      toast.success(t.Chat.reasoningEffort.success);
      setOpen(false);
    } catch {
      toast.error(t.Chat.reasoningEffort.failed);
    }
  };

  return (
    <HoverCard>
      <Popover
        open={open}
        onOpenChange={(newOpen) => {
          setOpen(newOpen);
        }}
      >
        <HoverCardTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 relative">
              <Brain className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-72">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <h4 className="font-medium text-sm">{t.Chat.reasoningEffort.title}</h4>
            </div>
            <p className="text-xs text-muted-foreground">{t.Chat.reasoningEffort.description}</p>
            {currentEffort && (
              <p className="text-xs">
                <span className="text-muted-foreground">
                  {t.Chat.reasoningEffort.currentEffort}:{' '}
                </span>
                <span className="font-medium">{currentEffort.label}</span>
              </p>
            )}
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{t.Chat.reasoningEffort.hint}</span>
            </div>
          </div>
        </HoverCardContent>

        <PopoverContent className="w-56 p-0" align="end">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="font-semibold text-sm">{t.Chat.reasoningEffort.title}</div>
            {currentEffort && (
              <span className="text-xs text-muted-foreground">{currentEffort.label}</span>
            )}
          </div>

          <div className="p-1">
            {REASONING_EFFORT_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => handleSelectEffort(level.value)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                  reasoningEffort === level.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0',
                    reasoningEffort === level.value
                      ? 'border-primary-foreground bg-primary-foreground'
                      : 'border-current opacity-50'
                  )}
                >
                  {reasoningEffort === level.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="flex-1 text-left">{level.label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </HoverCard>
  );
}
