import type React from 'react';
import { memo } from 'react';
import { ChatBox, type ChatBoxRef } from '@/components/chat-box';
import { ChatPanelHeader } from '@/components/chat-panel-header';
import { ResizablePanel } from '@/components/ui/resizable';
import type { Task } from '@/services/database-service';
import type { UIMessage } from '@/types/agent';
import type { OpenFile } from '@/types/file-system';

interface RepositoryChatPanelProps {
  mainChatPanelId: string;
  hasRepository: boolean;
  hasOpenFiles: boolean;
  isTerminalVisible: boolean;
  shouldShowSidebar: boolean;
  isChatFullscreen: boolean;
  currentTaskId: string | null | undefined;
  currentTask?: Task;
  messages?: UIMessage[];
  onNewChat: () => void;
  onToggleFullscreen: () => void;
  chatBoxRef: React.RefObject<ChatBoxRef | null>;
  rootPath: string | null;
  currentFile: OpenFile | null | undefined;
  onTaskStart: (taskId: string, title: string) => void;
  onDiffApplied: () => void;
  onFileSelect: (filePath: string, lineNumber?: number) => void;
  onAddFileToChat: (filePath: string, fileContent: string) => Promise<void>;
  checkForConflicts: () => Promise<boolean>;
}

export const RepositoryChatPanel = memo(function RepositoryChatPanel({
  mainChatPanelId,
  hasRepository,
  hasOpenFiles,
  isTerminalVisible,
  shouldShowSidebar,
  isChatFullscreen,
  currentTaskId,
  currentTask,
  messages,
  onNewChat,
  onToggleFullscreen,
  chatBoxRef,
  rootPath,
  currentFile,
  onTaskStart,
  onDiffApplied,
  onFileSelect,
  onAddFileToChat,
  checkForConflicts,
}: RepositoryChatPanelProps) {
  const order = hasRepository ? 3 : 2;
  const defaultSize = isChatFullscreen
    ? '100%'
    : hasRepository
      ? hasOpenFiles || isTerminalVisible
        ? '40%'
        : '80%'
      : shouldShowSidebar
        ? '80%'
        : '50%';
  const minSize = hasRepository ? '20%' : '30%';

  return (
    <ResizablePanel
      id={mainChatPanelId}
      order={order}
      className="bg-white dark:bg-gray-950"
      defaultSize={defaultSize}
      maxSize={'100%'}
      minSize={minSize}
    >
      <div className="flex h-full flex-col">
        <ChatPanelHeader
          currentTask={currentTask}
          messages={messages}
          onNewChat={onNewChat}
          isFullscreen={isChatFullscreen}
          onToggleFullscreen={onToggleFullscreen}
        />
        <div className="flex-1 overflow-hidden">
          <ChatBox
            ref={chatBoxRef}
            taskId={currentTaskId ?? undefined}
            fileContent={hasRepository ? currentFile?.content || null : null}
            onTaskStart={onTaskStart}
            onDiffApplied={onDiffApplied}
            repositoryPath={rootPath ?? undefined}
            selectedFile={hasRepository ? currentFile?.path || null : null}
            onFileSelect={onFileSelect}
            onAddFileToChat={onAddFileToChat}
            checkForConflicts={checkForConflicts}
          />
        </div>
      </div>
    </ResizablePanel>
  );
});
