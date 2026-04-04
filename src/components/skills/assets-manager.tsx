/**
 * Assets Manager Component
 *
 * Manages asset files in skill's assets/ directory
 */

import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { File, Image, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { logger } from '@/lib/logger';

interface Asset {
  filename: string;
  content: Uint8Array;
  size: number;
}

interface AssetsManagerProps {
  value: Asset[];
  onChange: (value: Asset[]) => void;
}

const ALLOWED_EXTENSIONS = ['.json', '.yaml', '.yml', '.svg', '.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function AssetsManager({ value, onChange }: AssetsManagerProps) {
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectAssets = async () => {
    try {
      setIsSelecting(true);

      const selected = await openDialog({
        multiple: true,
        filters: [
          {
            name: 'Asset Files',
            extensions: ['json', 'yaml', 'yml', 'svg', 'png', 'jpg', 'jpeg'],
          },
        ],
      });

      if (!selected) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const newAssets: Asset[] = [];

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
        if (value.some((a) => a.filename === filename)) {
          toast.error(`Asset ${filename} already exists`);
          continue;
        }

        // Read content
        try {
          const content = await readFile(filePath);
          const size = content.length;

          // Check size
          if (size > MAX_FILE_SIZE) {
            toast.error(`File ${filename} exceeds maximum size (5MB)`);
            continue;
          }

          newAssets.push({ filename, content, size });
        } catch (error) {
          logger.error(`Failed to read asset ${filename}:`, error);
          toast.error(`Failed to read ${filename}`);
        }
      }

      if (newAssets.length > 0) {
        onChange([...value, ...newAssets]);
        toast.success(`Added ${newAssets.length} asset${newAssets.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Failed to select assets:', error);
      toast.error('Failed to select assets');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleRemove = (filename: string) => {
    if (!confirm(`Remove asset "${filename}"?`)) {
      return;
    }
    onChange(value.filter((a) => a.filename !== filename));
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'svg'].includes(ext || '')) {
      return <Image className="h-4 w-4 text-muted-foreground" />;
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Asset Files</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectAssets}
          disabled={isSelecting}
        >
          <Plus className="h-4 w-4 mr-1" />
          {isSelecting ? 'Selecting...' : 'Add Assets'}
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8 border rounded-md border-dashed">
          No asset files added. Click "Add Assets" to add images, templates, or data files.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map(({ filename, size }) => (
            <div key={filename} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {getFileIcon(filename)}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{filename}</span>
                    <p className="text-xs text-muted-foreground">{formatSize(size)}</p>
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
        Asset files are stored in the skill's <code>assets/</code> directory. Maximum file size:
        5MB.
      </p>
    </div>
  );
}
