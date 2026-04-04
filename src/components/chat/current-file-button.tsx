// src/components/chat/current-file-button.tsx

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRepositoryStore } from '@/stores/window-scoped-repository-store';

interface CurrentFileButtonProps {
  disabled?: boolean;
  onAddFile: () => void;
}

export function CurrentFileButton({ disabled, onAddFile }: CurrentFileButtonProps) {
  const openFiles = useRepositoryStore((state) => state.openFiles);
  const activeFileIndex = useRepositoryStore((state) => state.activeFileIndex);

  // Get current file from store
  const currentFile =
    activeFileIndex >= 0 && activeFileIndex < openFiles.length ? openFiles[activeFileIndex] : null;

  // Only render if there's a current file with content
  if (!currentFile?.path || !currentFile?.content) {
    return null;
  }

  // Get filename for tooltip
  const fileName = currentFile.path.split('/').pop() || currentFile.path;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onAddFile}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Add Current File
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Add {fileName} to context</p>
      </TooltipContent>
    </Tooltip>
  );
}
