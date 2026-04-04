import { Eye, File, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileChangeItemProps {
  filePath: string;
  onOpen: (filePath: string) => void;
  onViewDiff?: (filePath: string) => void;
  showDiff: boolean;
}

export function FileChangeItem({ filePath, onOpen, onViewDiff, showDiff }: FileChangeItemProps) {
  const fileName = filePath.split('/').pop() || filePath;

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded border-b last:border-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <File className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <span className="font-mono text-sm truncate" title={filePath}>
          {fileName}
        </span>
      </div>

      <div className="flex gap-2 flex-shrink-0 ml-3">
        <Button size="sm" variant="outline" onClick={() => onOpen(filePath)} className="h-8 px-3">
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          Open
        </Button>

        {showDiff && onViewDiff && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDiff(filePath)}
            className="h-8 px-3"
          >
            <GitCompare className="h-3.5 w-3.5 mr-1.5" />
            View Diff
          </Button>
        )}
      </div>
    </div>
  );
}
