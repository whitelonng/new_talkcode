import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FilePen,
  FilePlus,
  FileQuestion,
  FileX,
} from 'lucide-react';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTranslation } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import { useGitStore } from '@/stores/git-store';
import type { FileStatus } from '@/types/git';
import { GitFileStatus } from '@/types/git';

function getStatusIcon(status: GitFileStatus) {
  switch (status) {
    case GitFileStatus.Added:
      return <FilePlus className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case GitFileStatus.Modified:
      return <FilePen className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />;
    case GitFileStatus.Deleted:
      return <FileX className="size-4 shrink-0 text-red-600 dark:text-red-400" />;
    case GitFileStatus.Renamed:
      return <FilePen className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />;
    case GitFileStatus.Untracked:
      return <FileQuestion className="size-4 shrink-0 text-muted-foreground" />;
    case GitFileStatus.Conflicted:
      return <AlertTriangle className="size-4 shrink-0 text-red-600 dark:text-red-400" />;
  }
}

interface FileGroupProps {
  title: string;
  files: Array<{ path: string; status: GitFileStatus }>;
  selectedFiles: Set<string>;
  onToggle: (filePath: string) => void;
  colorClass: string;
}

function FileGroup({ title, files, selectedFiles, onToggle, colorClass }: FileGroupProps) {
  const [open, setOpen] = useState(true);

  if (files.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold hover:bg-accent/50 rounded-sm select-none">
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className={cn('uppercase', colorClass)}>{title}</span>
        <span className="ml-auto text-muted-foreground">{files.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="flex flex-col">
          {files.map((file) => (
            <li key={file.path}>
              <label className="flex items-center gap-2 px-2 py-0.5 text-xs cursor-pointer hover:bg-accent/50 rounded-sm">
                <Checkbox
                  checked={selectedFiles.has(file.path)}
                  onCheckedChange={() => onToggle(file.path)}
                  className="size-3.5"
                />
                {getStatusIcon(file.status)}
                <span className="truncate text-foreground" title={file.path}>
                  {file.path}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function GitFileList() {
  const gitStatus = useGitStore((state) => state.gitStatus);
  const selectedFiles = useGitStore((state) => state.selectedFiles);
  const toggleFileSelection = useGitStore((state) => state.toggleFileSelection);
  const t = useTranslation();

  if (!gitStatus) return null;

  const { staged, modified, untracked, conflicted } = gitStatus;

  const stagedFiles = staged.map((f: FileStatus) => ({ path: f.path, status: f.status }));
  const modifiedFiles = modified.map((f: FileStatus) => ({ path: f.path, status: f.status }));
  const untrackedFiles = untracked.map((p: string) => ({
    path: p,
    status: GitFileStatus.Untracked,
  }));
  const conflictedFiles = conflicted.map((p: string) => ({
    path: p,
    status: GitFileStatus.Conflicted,
  }));

  const hasAny =
    stagedFiles.length > 0 ||
    modifiedFiles.length > 0 ||
    untrackedFiles.length > 0 ||
    conflictedFiles.length > 0;

  if (!hasAny) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
        {t.GitPanel.noChanges}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <FileGroup
        title={t.GitPanel.stagedChanges}
        files={stagedFiles}
        selectedFiles={selectedFiles}
        onToggle={toggleFileSelection}
        colorClass="text-emerald-600 dark:text-emerald-400"
      />
      <FileGroup
        title={t.GitPanel.changes}
        files={modifiedFiles}
        selectedFiles={selectedFiles}
        onToggle={toggleFileSelection}
        colorClass="text-sky-600 dark:text-sky-400"
      />
      <FileGroup
        title={t.GitPanel.untrackedFiles}
        files={untrackedFiles}
        selectedFiles={selectedFiles}
        onToggle={toggleFileSelection}
        colorClass="text-muted-foreground"
      />
      <FileGroup
        title={t.GitPanel.conflictedFiles}
        files={conflictedFiles}
        selectedFiles={selectedFiles}
        onToggle={toggleFileSelection}
        colorClass="text-red-600 dark:text-red-400"
      />
    </div>
  );
}
