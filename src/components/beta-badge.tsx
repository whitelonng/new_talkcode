import { cn } from '@/lib/utils';

interface BetaBadgeProps {
  className?: string;
  variant?: 'pill' | 'corner';
}

export function BetaBadge({ className, variant = 'pill' }: BetaBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm ring-1 ring-sky-200/60 dark:ring-indigo-900/40',
        variant === 'corner' && 'absolute -top-1 -right-1 rotate-1 shadow-lg',
        className
      )}
      title="Beta"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_0_3px_rgba(255,255,255,0.25)]"
        aria-hidden="true"
      />
      Beta
    </span>
  );
}
