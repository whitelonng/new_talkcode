// docs/components/share/share-message-list.tsx
// Message list component for shared conversations
import { memo } from 'react';
import type { ShareMessage } from '@/types/share';
import { ShareMessageItem } from './share-message-item';

interface ShareMessageListProps {
  messages: ShareMessage[];
}

function ShareMessageListComponent({ messages }: ShareMessageListProps) {
  // Filter messages: hide empty messages and tool-call only messages
  const filteredMessages = messages.filter((message) => {
    if (typeof message.content === 'string') {
      return message.content.trim().length > 0;
    }
    // For tool messages, only show if there are tool results
    if (Array.isArray(message.content)) {
      return message.content.some((item) => item.type === 'tool-result');
    }
    return true;
  });

  if (filteredMessages.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        No messages in this conversation.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {filteredMessages.map((message) => (
        <ShareMessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}

export const ShareMessageList = memo(ShareMessageListComponent);
