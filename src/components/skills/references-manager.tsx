/**
 * References Manager Component
 *
 * Manages reference files in skill's references/ directory
 */

import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { logger } from '@/lib/logger';

interface Reference {
  filename: string;
  content: string;
}

interface ReferencesManagerProps {
  value: Reference[];
  onChange: (value: Reference[]) => void;
}

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.json', '.yaml', '.yml'];

export function ReferencesManager({ value, onChange }: ReferencesManagerProps) {
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectReferences = async () => {
    try {
      setIsSelecting(true);

      const selected = await openDialog({
        multiple: true,
        filters: [
          {
            name: 'Reference Documents',
            extensions: ['md', 'txt', 'json', 'yaml', 'yml'],
          },
        ],
      });

      if (!selected) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const newReferences: Reference[] = [];

      for (const filePath of filePaths) {
        // Extract filename
        const filename = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';

        // Check extension
        const ext = `.${filename.split('.').pop()?.toLowerCase()}`;
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          toast.error(`Invalid file type: ${filename}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
          continue;
        }

        // Check if already exists
        if (value.some((r) => r.filename === filename)) {
          toast.error(`Reference ${filename} already exists`);
          continue;
        }

        // Read content
        try {
          const content = await readTextFile(filePath);
          newReferences.push({ filename, content });
        } catch (error) {
          logger.error(`Failed to read reference ${filename}:`, error);
          toast.error(`Failed to read ${filename}`);
        }
      }

      if (newReferences.length > 0) {
        onChange([...value, ...newReferences]);
        toast.success(
          `Added ${newReferences.length} reference${newReferences.length > 1 ? 's' : ''}`
        );
      }
    } catch (error) {
      logger.error('Failed to select references:', error);
      toast.error('Failed to select references');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleRemove = (filename: string) => {
    if (!confirm(`Remove reference "${filename}"?`)) {
      return;
    }
    onChange(value.filter((r) => r.filename !== filename));
  };

  const getFileIcon = (_filename: string) => {
    // Could customize icons based on file type
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Reference Documents</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectReferences}
          disabled={isSelecting}
        >
          <Plus className="h-4 w-4 mr-1" />
          {isSelecting ? 'Selecting...' : 'Add References'}
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8 border rounded-md border-dashed">
          No reference documents added. Click "Add References" to add documentation files.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map(({ filename, content }) => (
            <div key={filename} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {getFileIcon(filename)}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{filename}</span>
                    <p className="text-xs text-muted-foreground truncate">
                      {content.split('\n').length} lines, {content.length} characters
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(filename)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Reference documents are stored in the skill's <code>references/</code> directory and can be
        accessed by AI during execution.
      </p>
    </div>
  );
}
