import { AlertCircle, AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { useTranslation } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import type { LintDiagnostic } from '@/services/lint-service';

interface DiagnosticItemProps {
  diagnostic: LintDiagnostic;
  isSelected?: boolean;
  onClick?: () => void;
  onFixClick?: (event: React.MouseEvent) => void;
  showFixButton?: boolean;
}

const severityConfig = {
  error: {
    icon: AlertCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    labelKey: 'error' as const,
    labelColor: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    labelKey: 'warning' as const,
    labelColor: 'text-yellow-600 dark:text-yellow-400',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    labelKey: 'info' as const,
    labelColor: 'text-blue-600 dark:text-blue-400',
  },
};

export function DiagnosticItem({
  diagnostic,
  isSelected = false,
  onClick,
  onFixClick,
  showFixButton = false,
}: DiagnosticItemProps) {
  const t = useTranslation();
  const config = severityConfig[diagnostic.severity];
  const Icon = config.icon;

  const handleClick = () => {
    onClick?.();
  };

  const handleFixClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFixClick?.(e);
  };

  return (
    <button
      type="button"
      className={cn(
        'group relative flex cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50 w-full text-left',
        config.bgColor,
        config.borderColor,
        isSelected && 'ring-2 ring-primary ring-offset-1'
      )}
      onClick={handleClick}
    >
      {/* Severity indicator */}
      <div className="flex-shrink-0 mr-3">
        <div
          className={cn('flex h-6 w-6 items-center justify-center rounded-full', config.bgColor)}
        >
          <Icon className={cn('h-3 w-3', config.iconColor)} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
                  config.bgColor,
                  config.labelColor
                )}
              >
                {t.Lint[config.labelKey]}
              </span>
              {diagnostic.code && (
                <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                  {diagnostic.code}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {t.Lint.lineColumn(diagnostic.range.start.line, diagnostic.range.start.column)}
              </span>
            </div>
            <p className="text-sm font-medium leading-tight">{diagnostic.message}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {showFixButton && (
              <button
                type="button"
                onClick={handleFixClick}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                title={t.Lint.quickFix}
              >
                {t.Lint.fix}
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80 transition-colors text-muted-foreground"
              title={t.Lint.viewInEditor}
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Related information */}
        {diagnostic.relatedInformation && diagnostic.relatedInformation.length > 0 && (
          <div className="mt-2 space-y-1">
            {diagnostic.relatedInformation.map((info) => (
              <div
                key={info.message}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <div className="mt-1 h-1 w-1 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                <div>
                  <span className="font-medium">{info.message}</span>
                  {info.location && (
                    <span className="ml-2 text-muted-foreground/75">
                      {t.Lint.lineColumn(info.location.start.line, info.location.start.column)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
