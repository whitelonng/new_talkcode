'use client';

import { ArrowDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TaskProps = ComponentProps<typeof StickToBottom>;

export const Task = ({ className, ...props }: TaskProps) => (
  <StickToBottom
    className={cn('relative flex-1', className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type TaskContentProps = ComponentProps<typeof StickToBottom.Content>;

export const TaskContent = ({ className, ...props }: TaskContentProps) => (
  <StickToBottom.Content className={cn('p-4', className)} {...props} />
);

export type TaskScrollButtonProps = ComponentProps<typeof Button>;

export const TaskScrollButton = ({ className, ...props }: TaskScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn('absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full', className)}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};
