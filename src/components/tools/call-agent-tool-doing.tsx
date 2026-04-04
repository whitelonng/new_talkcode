import { getToolUIRenderers } from '@/lib/tool-adapter';
import { useNestedToolsStore } from '@/stores/nested-tools-store';
import type { ToolMessageContent, UIMessage } from '@/types/agent';
import { GenericToolDoing } from './generic-tool-doing';
import { ToolErrorBoundary } from './tool-error-boundary';
import { renderNestedToolsList } from './tool-utils';

// Stable empty array reference to avoid unnecessary re-renders
const EMPTY_MESSAGES: UIMessage[] = [];

type CallAgentToolDoingProps = {
  agentId: string;
  task: string;
  toolCallId?: string;
  taskId?: string;
};

export function CallAgentToolDoing({ agentId, task, toolCallId, taskId }: CallAgentToolDoingProps) {
  // Read nested tools from Zustand store using toolCallId
  // Direct state access for proper dependency tracking
  // Use stable EMPTY_MESSAGES reference when no messages exist
  const nestedToolsFromStore = useNestedToolsStore((state): UIMessage[] =>
    toolCallId ? (state.messagesByParent[toolCallId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );

  // Extract tool calls that need to render their "doing" UI
  const toolCallsToRender = nestedToolsFromStore.flatMap((msg) => {
    if (msg.role !== 'tool' || !msg.renderDoingUI || !Array.isArray(msg.content)) return [];

    return msg.content.filter(
      (content): content is ToolMessageContent & { type: 'tool-call' } =>
        content.type === 'tool-call' &&
        // Ensure there is no corresponding tool-result for this tool call yet
        !nestedToolsFromStore.some(
          (otherMsg) =>
            Array.isArray(otherMsg.content) &&
            otherMsg.content.some(
              (otherContent) =>
                otherContent.type === 'tool-result' &&
                otherContent.toolCallId === content.toolCallId
            )
        )
    );
  });

  return (
    <div className="space-y-3">
      <GenericToolDoing type="agent" operation="call" target={`Agent: ${agentId}`} details={task} />

      {renderNestedToolsList(nestedToolsFromStore, {
        pendingColor: 'purple',
        completedColor: 'green',
      })}

      {/* Render interactive UI for pending tools that require user attention */}
      {toolCallsToRender.length > 0 && taskId && (
        <div className="space-y-4 pt-2 border-t dark:border-gray-700">
          {toolCallsToRender.map((toolCall) => {
            const renderers = getToolUIRenderers(toolCall.toolName);
            if (!renderers) return null;

            return (
              <div key={toolCall.toolCallId} className="animate-in fade-in slide-in-from-top-2">
                <ToolErrorBoundary toolName={toolCall.toolName}>
                  {renderers.renderToolDoing(toolCall.input || {}, {
                    taskId,
                  })}
                </ToolErrorBoundary>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
