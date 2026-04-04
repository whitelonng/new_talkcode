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
import { useLocale } from '@/hooks/use-locale';
import { repositoryService } from '@/services/repository-service';
import { useRepositoryStore } from '@/stores/window-scoped-repository-store';

export function ExternalFileChangeDialog() {
  const { t } = useLocale();
  const pendingExternalChange = useRepositoryStore((state) => state.pendingExternalChange);
  const applyExternalChange = useRepositoryStore((state) => state.applyExternalChange);

  if (!pendingExternalChange) {
    return null;
  }

  const fileName = repositoryService.getFileNameFromPath(pendingExternalChange.filePath);

  return (
    <AlertDialog open={!!pendingExternalChange} onOpenChange={() => applyExternalChange(true)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.ExternalFileChange.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.ExternalFileChange.description(fileName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => applyExternalChange(true)}>
            {t.ExternalFileChange.keepLocal}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => applyExternalChange(false)}>
            {t.ExternalFileChange.loadDisk}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
