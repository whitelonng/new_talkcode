// src/components/file-tree.tsx
import { ask } from '@tauri-apps/plugin-dialog';
import {
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Edit,
  File,
  Folder,
  Globe,
  MessageSquareQuote,
  RefreshCw,
  Scissors,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useTranslation } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { fileExplorerService } from '@/services/file-explorer-service';
import { repositoryService } from '@/services/repository-service';
import { useGitStore } from '@/stores/git-store';
import type { FileNode } from '@/types/file-system';
import { GitFileStatus } from '@/types/git';

// Global state for clipboard operations
type ClipboardOperation = {
  type: 'cut' | 'copy';
  paths: string[];
};

let clipboardState: ClipboardOperation | null = null;

function canOpenInBrowser(filePath: string): boolean {
  return /\.(html?|svg)$/i.test(filePath);
}

// Helper function to get Git status color for file name
function getGitStatusColor(status: GitFileStatus | null): string {
  if (!status) {
    return '';
  }

  switch (status) {
    case GitFileStatus.Modified:
      return 'git-status-modified'; // Yellow for modified files
    case GitFileStatus.Added:
    case GitFileStatus.Untracked:
      return 'git-status-added'; // Green for new files
    case GitFileStatus.Deleted:
      return 'git-status-deleted'; // Red for deleted files
    case GitFileStatus.Renamed:
      return 'git-status-renamed'; // Purple for renamed files
    case GitFileStatus.Conflicted:
      return 'git-status-conflicted'; // Orange for conflicts
    default:
      return '';
  }
}

// Git status badge component
function GitStatusBadge({ filePath }: { filePath: string }) {
  const getFileStatus = useGitStore((state) => state.getFileStatus);
  const status = getFileStatus(filePath);

  if (!status) {
    return null;
  }

  const getStatusInfo = (status: GitFileStatus) => {
    switch (status) {
      case GitFileStatus.Modified:
        return { label: 'M', className: 'bg-blue-500 text-white' };
      case GitFileStatus.Added:
        return { label: 'A', className: 'bg-green-500 text-white' };
      case GitFileStatus.Deleted:
        return { label: 'D', className: 'bg-red-500 text-white' };
      case GitFileStatus.Renamed:
        return { label: 'R', className: 'bg-purple-500 text-white' };
      case GitFileStatus.Untracked:
        return { label: 'U', className: 'bg-gray-500 text-white' };
      case GitFileStatus.Conflicted:
        return { label: 'C', className: 'bg-orange-500 text-white' };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo(status);
  if (!statusInfo) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className={cn('ml-2 px-1 py-0 text-xs font-mono', statusInfo.className)}
    >
      {statusInfo.label}
    </Badge>
  );
}

interface FileTreeProps {
  fileTree: FileNode;
  selectedFile: string | null;
  repositoryPath?: string; // Add repository path for relative path calculations
  expandedPaths: Set<string>;
  onFileSelect: (filePath: string) => void;
  onFileDelete?: (filePath: string) => void;
  onFileRename?: (oldPath: string, newName: string) => void;
  onFileCreate?: (parentPath: string, fileName: string, isDirectory: boolean) => void;
  onOpenInBrowser?: (filePath: string) => Promise<void>;
  onRefresh?: () => void;
  onLoadChildren?: (node: FileNode) => Promise<FileNode[]>;
  onToggleExpansion?: (path: string) => void;
  onReferenceToChat?: (filePath: string) => void;
}

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  selectedFile: string | null;
  repositoryPath?: string;
  expandedPaths: Set<string>;
  onFileSelect: (filePath: string) => void;
  onFileDelete?: (filePath: string) => void;
  onFileRename?: (oldPath: string, newName: string) => void;
  onFileCreate?: (parentPath: string, fileName: string, isDirectory: boolean) => void;
  onOpenInBrowser?: (filePath: string) => Promise<void>;
  onRefresh?: () => void;
  onLoadChildren?: (node: FileNode) => Promise<FileNode[]>;
  onToggleExpansion?: (path: string) => void;
  onReferenceToChat?: (filePath: string) => void;
}

function FileTreeNode({
  node,
  level,
  selectedFile,
  repositoryPath,
  expandedPaths,
  onFileSelect,
  onFileDelete,
  onFileRename,
  onFileCreate,
  onOpenInBrowser,
  onRefresh,
  onLoadChildren,
  onToggleExpansion,
  onReferenceToChat,
}: FileTreeNodeProps) {
  const t = useTranslation();
  const { isRetromaTheme } = useTheme();
  // Subscribe to lastRefresh to trigger re-render when Git data changes
  useGitStore((state) => state.lastRefresh); // Triggers re-render when Git status refreshes
  const getFileStatus = useGitStore((state) => state.getFileStatus);

  // Get Git status only for files (not directories) - will update when lastRefresh changes
  const gitStatus = !node.is_directory ? getFileStatus(node.path) : null;
  const fileNameColorClass = getGitStatusColor(gitStatus);

  // Use controlled expansion state from the store
  const isExpanded = expandedPaths.has(node.path);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameName, setRenameName] = useState(node.name);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const [_contextMenuOpen, setContextMenuOpen] = useState(false);
  const contextMenuJustClosed = useRef(false);
  const nodeRef = useRef<HTMLButtonElement>(null);

  // Focus input when creating new item
  useEffect(() => {
    if ((isCreatingFile || isCreatingFolder) && newItemInputRef.current) {
      newItemInputRef.current.focus();
    }
  }, [isCreatingFile, isCreatingFolder]);

  // Scroll selected file into view
  useEffect(() => {
    if (selectedFile === node.path && nodeRef.current) {
      nodeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedFile, node.path]);

  const handleToggleDirectory = useCallback(async () => {
    if (node.is_directory && node.is_lazy_loaded && !isExpanded) {
      setIsLoadingChildren(true);
      try {
        if (onLoadChildren) {
          await onLoadChildren(node);
        }
        onToggleExpansion?.(node.path);
      } catch (error) {
        logger.error('Failed to load directory children:', error);
        toast.error(t.FileTree.errors.failedToLoadDirectory);
      } finally {
        setIsLoadingChildren(false);
      }
    } else {
      onToggleExpansion?.(node.path);
    }
  }, [
    node,
    isExpanded,
    onLoadChildren,
    onToggleExpansion,
    t.FileTree.errors.failedToLoadDirectory,
  ]);

  const handleClick = (_e: React.MouseEvent) => {
    // If context menu just closed, ignore this click to prevent accidental actions
    if (contextMenuJustClosed.current) {
      contextMenuJustClosed.current = false;
      return;
    }

    if (isRenaming || isCreatingFile || isCreatingFolder || isLoadingChildren) return;

    if (node.is_directory) {
      handleToggleDirectory();
    } else {
      onFileSelect(node.path);
    }
  };

  const handleContextMenuOpenChange = (open: boolean) => {
    setContextMenuOpen(open);
    if (!open) {
      // Set flag to prevent immediate click after menu closes
      contextMenuJustClosed.current = true;
      // Clear the flag after a short delay
      setTimeout(() => {
        contextMenuJustClosed.current = false;
      }, 100);
    }
  };

  const handleRename = () => {
    setIsRenaming(true);
    setRenameName(node.name);

    // Focus input after state update
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleRenameSubmit = () => {
    if (renameName.trim() && renameName !== node.name) {
      onFileRename?.(node.path, renameName.trim());
      toast.success(t.FileTree.success.renamed(renameName));
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameName(node.name);
  };

  const handleDelete = async () => {
    // Prevent multiple delete operations
    if (isDeleting) {
      return;
    }
    setIsDeleting(true);

    try {
      const shouldDelete = await ask(`Are you sure you want to delete ${node.name}?`, {
        title: `Delete ${node.name}`,
        kind: 'warning',
      });

      if (shouldDelete) {
        await repositoryService.deleteFile(node.path);
        onFileDelete?.(node.path);
        toast.success(t.FileTree.success.deleted(node.name));
      }
    } catch (error) {
      logger.error('Failed to delete file:', error);
      toast.error(
        t.FileTree.errors.deleteFailed(
          node.name,
          error instanceof Error ? error.message : 'Unknown error'
        )
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(node.path);
    toast.success(t.FileTree.success.pathCopied);
  };

  const handleCopyRelativePath = () => {
    if (!repositoryPath) {
      toast.error(t.FileTree.errors.repositoryPathNotAvailable);
      return;
    }
    const relativePath = repositoryService.getRelativePath(node.path, repositoryPath);
    navigator.clipboard.writeText(relativePath);
    toast.success(t.FileTree.success.relativePathCopied);
  };

  const handleCut = () => {
    clipboardState = { type: 'cut', paths: [node.path] };
    toast.success(t.FileTree.success.cutToClipboard(node.name));
  };

  const handleCopy = () => {
    clipboardState = { type: 'copy', paths: [node.path] };
    toast.success(t.FileTree.success.copiedToClipboard(node.name));
  };

  const handlePaste = async () => {
    if (!clipboardState || clipboardState.paths.length === 0) {
      toast.error(t.FileTree.errors.nothingToPaste);
      return;
    }

    const targetDir = node.is_directory
      ? node.path
      : node.path.substring(0, node.path.lastIndexOf('/'));

    try {
      for (const sourcePath of clipboardState.paths) {
        const fileName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1);
        let targetPath = `${targetDir}/${fileName}`;

        // Handle name conflicts by adding a suffix
        let counter = 1;
        while (await repositoryService.checkFileExists(targetPath)) {
          const nameWithoutExt =
            fileName.lastIndexOf('.') > 0
              ? fileName.substring(0, fileName.lastIndexOf('.'))
              : fileName;
          const ext =
            fileName.lastIndexOf('.') > 0 ? fileName.substring(fileName.lastIndexOf('.')) : '';
          targetPath = `${targetDir}/${nameWithoutExt}_copy${counter > 1 ? counter : ''}${ext}`;
          counter++;
        }

        if (clipboardState.type === 'cut') {
          await repositoryService.moveFile(sourcePath, targetPath);
          toast.success(t.FileTree.success.moved(fileName));
        } else {
          // Use the new copy method
          await repositoryService.copyFileOrDirectory(sourcePath, targetPath);
          toast.success(t.FileTree.success.copied(fileName));
        }
      }

      if (clipboardState.type === 'cut') {
        clipboardState = null; // Clear clipboard after cut operation
      }

      onRefresh?.();
    } catch (error) {
      logger.error('Paste operation failed:', error);
      toast.error(
        t.FileTree.errors.pasteFailed(error instanceof Error ? error.message : 'Unknown error')
      );
    }
  };

  const handleNewItemSubmit = () => {
    const trimmedName = newItemName.trim();
    if (trimmedName) {
      const parentPath = node.is_directory
        ? node.path
        : node.path.substring(0, node.path.lastIndexOf('/'));
      const isDirectory = isCreatingFolder;

      onFileCreate?.(parentPath, trimmedName, isDirectory);
      toast.success(
        t.FileTree.success.itemCreated(
          isDirectory ? t.FileTree.contextMenu.newFolder : t.FileTree.contextMenu.newFile
        )
      );
    }

    setIsCreatingFile(false);
    setIsCreatingFolder(false);
    setNewItemName('');
  };

  const handleNewItemCancel = () => {
    setIsCreatingFile(false);
    setIsCreatingFolder(false);
    setNewItemName('');
  };

  const handleRefresh = () => {
    onRefresh?.();
    toast.success(t.FileTree.success.refreshed);
  };

  const handleOpenInExplorer = async () => {
    try {
      await fileExplorerService.openPath(node.path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open in explorer');
    }
  };

  const handleReferenceToChat = () => {
    onReferenceToChat?.(node.path);
  };

  const isSelected = selectedFile === node.path;
  const isCut = clipboardState?.type === 'cut' && clipboardState.paths.includes(node.path);
  const isGitIgnored = node.is_git_ignored ?? false;
  const paddingLeft = level * 4;

  const fileTreeItem = (
    <button
      type="button"
      ref={nodeRef}
      className={cn(
        'file-tree-item flex w-full cursor-pointer items-center border-0 px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800',
        isSelected && 'bg-blue-100 dark:bg-blue-900/30',
        isCut && 'opacity-50',
        isGitIgnored && 'opacity-60'
      )}
      data-selected={isSelected}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      style={{ paddingLeft: `${paddingLeft + 4}px` }}
    >
      <div className="flex min-w-0 flex-1 items-center">
        {node.is_directory ? (
          node.has_children || (node.children && node.children.length > 0) ? (
            isExpanded ? (
              <ChevronDown
                className={cn(
                  'mr-1 h-4 w-4 flex-shrink-0',
                  isGitIgnored && 'text-muted-foreground'
                )}
              />
            ) : (
              <ChevronRight
                className={cn(
                  'mr-1 h-4 w-4 flex-shrink-0',
                  isGitIgnored && 'text-muted-foreground'
                )}
              />
            )
          ) : (
            <div className="mr-1 h-4 w-4" />
          )
        ) : (
          <>
            <div className="mr-1 h-4 w-4" />
            <File
              className={cn(
                'mr-2 h-4 w-4 flex-shrink-0 text-gray-600',
                isRetromaTheme && 'text-muted-foreground',
                isGitIgnored && 'text-muted-foreground'
              )}
            />
          </>
        )}

        {isRenaming ? (
          <input
            className="min-w-0 flex-1 rounded border border-blue-500 bg-white px-1 py-0 text-sm dark:bg-gray-800"
            onBlur={handleRenameSubmit}
            onChange={(e) => setRenameName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameSubmit();
              } else if (e.key === 'Escape') {
                handleRenameCancel();
              }
            }}
            ref={inputRef}
            type="text"
            value={renameName}
          />
        ) : (
          <>
            <span
              className={cn(
                'truncate',
                fileNameColorClass,
                isGitIgnored && 'text-muted-foreground'
              )}
              title={node.name}
            >
              {node.name}
            </span>
            {!node.is_directory && <GitStatusBadge filePath={node.path} />}
          </>
        )}

        {isLoadingChildren && (
          <span className="ml-2 text-muted-foreground text-xs">{t.FileTree.states.loading}</span>
        )}
      </div>
    </button>
  );

  return (
    <div>
      <ContextMenu onOpenChange={handleContextMenuOpenChange}>
        <ContextMenuTrigger asChild>{fileTreeItem}</ContextMenuTrigger>
        <ContextMenuContent>
          {!node.is_directory && onOpenInBrowser && canOpenInBrowser(node.path) && (
            <>
              <ContextMenuItem onClick={() => onOpenInBrowser(node.path)}>
                <Globe className="mr-2 h-4 w-4" />
                {t.Share.openInBrowser}
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => void handleOpenInExplorer()}>
            <Folder className="mr-2 h-4 w-4" />
            {t.Share.openInExplorer}
          </ContextMenuItem>
          {onReferenceToChat && (
            <ContextMenuItem onClick={handleReferenceToChat}>
              <MessageSquareQuote className="mr-2 h-4 w-4" />
              {t.FileTree.contextMenu.referenceToChat}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCut}>
            <Scissors className="mr-2 h-4 w-4" />
            {t.FileTree.contextMenu.cut}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {t.FileTree.contextMenu.copy}
          </ContextMenuItem>
          {clipboardState && (
            <ContextMenuItem onClick={handlePaste}>
              <ClipboardPaste className="mr-2 h-4 w-4" />
              {t.FileTree.contextMenu.paste}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRename}>
            <Edit className="mr-2 h-4 w-4" />
            {t.FileTree.contextMenu.rename}
          </ContextMenuItem>
          <ContextMenuItem
            className="text-red-600 dark:text-red-400"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? t.FileTree.contextMenu.deleting : t.FileTree.contextMenu.delete}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyPath}>
            <Copy className="mr-2 h-4 w-4" />
            {t.FileTree.contextMenu.copyPath}
          </ContextMenuItem>
          {repositoryPath && (
            <ContextMenuItem onClick={handleCopyRelativePath}>
              <Copy className="mr-2 h-4 w-4" />
              {t.FileTree.contextMenu.copyRelativePath}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t.FileTree.contextMenu.refresh}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {node.is_directory && isExpanded && (
        <div>
          {/* Show new item creation input */}
          {(isCreatingFile || isCreatingFolder) && (
            <div
              className="flex cursor-text items-center px-2 py-1 text-sm"
              style={{ paddingLeft: `${(level + 1) * 4 + 4}px` }}
            >
              <div className="flex min-w-0 flex-1 items-center">
                <div className="mr-1 h-4 w-4" />
                {isCreatingFolder ? (
                  <Folder className="mr-2 h-4 w-4 flex-shrink-0 text-blue-600" />
                ) : (
                  <File className="mr-2 h-4 w-4 flex-shrink-0 text-gray-600" />
                )}
                <input
                  className="min-w-0 flex-1 rounded border border-green-500 bg-white px-1 py-0 text-sm dark:bg-gray-800"
                  onBlur={handleNewItemSubmit}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleNewItemSubmit();
                    } else if (e.key === 'Escape') {
                      handleNewItemCancel();
                    }
                  }}
                  placeholder={
                    isCreatingFolder
                      ? t.FileTree.placeholder.folderName
                      : t.FileTree.placeholder.fileName
                  }
                  ref={newItemInputRef}
                  type="text"
                  value={newItemName}
                />
              </div>
            </div>
          )}

          {/* Render existing children */}
          {node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              level={level + 1}
              node={child}
              repositoryPath={repositoryPath}
              expandedPaths={expandedPaths}
              onFileCreate={onFileCreate}
              onFileDelete={onFileDelete}
              onFileRename={onFileRename}
              onFileSelect={onFileSelect}
              onOpenInBrowser={onOpenInBrowser}
              onRefresh={onRefresh}
              onLoadChildren={onLoadChildren}
              onToggleExpansion={onToggleExpansion}
              onReferenceToChat={onReferenceToChat}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  fileTree,
  selectedFile,
  repositoryPath,
  expandedPaths,
  onFileSelect,
  onFileDelete,
  onFileRename,
  onFileCreate,
  onOpenInBrowser,
  onRefresh,
  onLoadChildren,
  onToggleExpansion,
  onReferenceToChat,
}: FileTreeProps) {
  return (
    <div className="h-full overflow-auto">
      <FileTreeNode
        level={0}
        node={fileTree}
        repositoryPath={repositoryPath}
        expandedPaths={expandedPaths}
        onFileCreate={onFileCreate}
        onFileDelete={onFileDelete}
        onFileRename={onFileRename}
        onFileSelect={onFileSelect}
        onOpenInBrowser={onOpenInBrowser}
        onRefresh={onRefresh}
        onLoadChildren={onLoadChildren}
        onToggleExpansion={onToggleExpansion}
        onReferenceToChat={onReferenceToChat}
        selectedFile={selectedFile}
      />
    </div>
  );
}
