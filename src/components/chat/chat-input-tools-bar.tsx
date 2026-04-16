// src/components/chat/chat-input-tools-bar.tsx

import { AutoApproveButton } from './auto-approve-button';
import { CurrentFileButton } from './current-file-button';
import { McpSelectorButton } from './mcp-selector-button';
import { ModelSelectorButton } from './model-selector-button';
// import { OutputFormatButton } from './output-format-button';
import { PromptEnhancementOptionsButton } from './prompt-enhancement-options-button';
import { ReasoningEffortButton } from './reasoning-effort-button';
import { SkillsSelectorButton } from './skills-selector-button';
import { ToolSelectorButton } from './tool-selector-button';

interface ChatInputToolsBarProps {
  taskId?: string | null;
  disabled?: boolean;
  onAddCurrentFile?: () => void;
}

export function ChatInputToolsBar({ taskId, disabled, onAddCurrentFile }: ChatInputToolsBarProps) {
  return (
    <div className="retroma-tools-bar flex items-center gap-2 border-b border-border/50 px-2 py-1">
      <ToolSelectorButton />
      <SkillsSelectorButton taskId={taskId} />
      <McpSelectorButton />
      <ModelSelectorButton taskId={taskId} />
      {/* <OutputFormatButton /> */}
      <ReasoningEffortButton />
      <AutoApproveButton />
      <PromptEnhancementOptionsButton />
      {onAddCurrentFile && <CurrentFileButton disabled={disabled} onAddFile={onAddCurrentFile} />}
    </div>
  );
}
