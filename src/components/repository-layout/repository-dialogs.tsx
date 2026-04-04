import { memo } from 'react';
import { ExternalFileChangeDialog } from '@/components/external-file-change-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { WorktreeConflictDialog } from '@/components/worktree/worktree-conflict-dialog';
import { useTranslation } from '@/hooks/use-locale';
import type { ConflictData } from '@/hooks/use-worktree-conflict';
import type { MergeResult, SyncResult } from '@/types/worktree';

interface DeleteConfirmationState {
  taskId: string;
  changesCount: number;
  message: string;
}

interface RepositoryDialogsProps {
  conflictData: ConflictData | null;
  isProcessing: boolean;
  mergeResult: MergeResult | null;
  syncResult: SyncResult | null;
  onDiscard: () => Promise<void>;
  onMerge: () => Promise<void>;
  onSync: () => Promise<void>;
  onCancel: () => void;
  onClose: () => void;
  deleteConfirmation: DeleteConfirmationState | null;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export const RepositoryDialogs = memo(function RepositoryDialogs({
  conflictData,
  isProcessing,
  mergeResult,
  syncResult,
  onDiscard,
  onMerge,
  onSync,
  onCancel,
  onClose,
  deleteConfirmation,
  onCancelDelete,
  onConfirmDelete,
}: RepositoryDialogsProps) {
  const t = useTranslation();

  return (
    <>
      <WorktreeConflictDialog
        open={!!conflictData}
        worktreePath={conflictData?.worktreePath ?? ''}
        changes={conflictData?.changes ?? null}
        isProcessing={isProcessing}
        mergeResult={mergeResult}
        syncResult={syncResult}
        onDiscard={onDiscard}
        onMerge={onMerge}
        onSync={onSync}
        onCancel={onCancel}
        onClose={onClose}
      />

      <AlertDialog open={!!deleteConfirmation} onOpenChange={onCancelDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.RepositoryLayout.deleteTaskWithChangesTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteConfirmation?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelDelete}>{t.Common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirmDelete}
            >
              {t.RepositoryLayout.deleteAnyway}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExternalFileChangeDialog />
    </>
  );
});
