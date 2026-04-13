import { Brain } from 'lucide-react';
import { memo } from 'react';
import { CollapsibleProcessBlock } from '@/components/chat/collapsible-process-block';

interface CollapsibleReasoningProps {
  text: string;
  isStreaming: boolean;
}

function CollapsibleReasoningComponent({ text, isStreaming }: CollapsibleReasoningProps) {
  return (
    <CollapsibleProcessBlock
      text={text}
      isActive={isStreaming}
      title={isStreaming ? 'Thinking...' : 'Thinking'}
      icon={<Brain className={`h-4 w-4 flex-shrink-0 ${isStreaming ? 'animate-pulse' : ''}`} />}
    />
  );
}

export const CollapsibleReasoning = memo(CollapsibleReasoningComponent);
