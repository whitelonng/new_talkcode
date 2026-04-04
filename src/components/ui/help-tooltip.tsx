import { CircleHelp, ExternalLink } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card';

interface HelpTooltipProps {
  title: string;
  description: string;
  docUrl?: string;
  docLabel?: string;
}

export function HelpTooltip({
  title,
  description,
  docUrl,
  docLabel = 'Learn more',
}: HelpTooltipProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Help: ${title}`}
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {docLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
