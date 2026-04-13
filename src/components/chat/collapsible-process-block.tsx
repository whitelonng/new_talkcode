import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleProcessBlockProps {
  text: string;
  isActive: boolean;
  title: string;
  icon: React.ReactNode;
  className?: string;
  previewLength?: number;
}

function CollapsibleProcessBlockComponent({
  text,
  isActive,
  title,
  icon,
  className,
  previewLength = 80,
}: CollapsibleProcessBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isActive);

  useEffect(() => {
    setIsExpanded(isActive);
  }, [isActive]);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const previewText = text.length > previewLength ? `${text.slice(0, previewLength)}...` : text;

  return (
    <div className={cn('my-2 rounded-lg border border-border bg-muted/30', className)}>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50"
        onClick={handleToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        <div className={cn('flex-shrink-0', isActive && 'text-primary')}>{icon}</div>
        <span className="font-medium">{title}</span>
        {!isExpanded && <span className="ml-2 truncate text-xs opacity-60">{previewText}</span>}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-1">
          <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{text}</div>
        </div>
      )}
    </div>
  );
}

export const CollapsibleProcessBlock = memo(CollapsibleProcessBlockComponent);
