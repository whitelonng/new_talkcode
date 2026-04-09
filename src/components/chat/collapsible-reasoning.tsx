// src/components/chat/collapsible-reasoning.tsx

import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

interface CollapsibleReasoningProps {
  text: string;
  isStreaming: boolean;
}

function CollapsibleReasoningComponent({ text, isStreaming }: CollapsibleReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  const [userToggled, setUserToggled] = useState(false);
  const prevStreamingRef = useRef(isStreaming);

  // Auto-expand when streaming starts, auto-collapse when streaming ends
  useEffect(() => {
    // Streaming just started
    if (isStreaming && !prevStreamingRef.current) {
      if (!userToggled) {
        setIsExpanded(true);
      }
    }
    // Streaming just ended
    if (!isStreaming && prevStreamingRef.current) {
      if (!userToggled) {
        setIsExpanded(false);
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, userToggled]);

  const handleToggle = useCallback(() => {
    setUserToggled(true);
    setIsExpanded((prev) => !prev);
  }, []);

  // Generate preview text (first ~80 chars)
  const previewText = text.length > 80 ? `${text.slice(0, 80)}...` : text;

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/50 transition-colors rounded-lg"
        onClick={handleToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        <Brain
          className={`h-4 w-4 flex-shrink-0 ${isStreaming ? 'animate-pulse text-primary' : ''}`}
        />
        <span className="font-medium">{isStreaming ? 'Thinking...' : 'Thinking'}</span>
        {!isExpanded && <span className="truncate text-xs opacity-60 ml-2">{previewText}</span>}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-1">
          <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}

export const CollapsibleReasoning = memo(CollapsibleReasoningComponent);
