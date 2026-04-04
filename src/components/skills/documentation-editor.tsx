// Documentation editor component for skill creation/editing

import { open } from '@tauri-apps/plugin-dialog';
import { File, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { logger } from '@/lib/logger';
import type { DocumentationItem } from '@/types/skill';

interface DocumentationEditorProps {
  documentation: DocumentationItem[];
  onChange: (documentation: DocumentationItem[]) => void;
}

export function DocumentationEditor({ documentation, onChange }: DocumentationEditorProps) {
  const [selecting, setSelecting] = useState(false);

  const handleSelectFiles = async () => {
    try {
      setSelecting(true);

      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Documentation',
            extensions: ['md', 'txt', 'pdf'],
          },
        ],
      });

      if (!selected) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const newDocs: DocumentationItem[] = [];

      for (const filePath of filePaths) {
        // Extract filename from path
        const filename = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';

        // Check if already exists
        if (documentation.some((doc) => doc.filename === filename)) {
          toast.error(`File ${filename} is already added`);
          continue;
        }

        newDocs.push({
          filename,
          originalPath: filePath,
        });
      }

      if (newDocs.length > 0) {
        onChange([...documentation, ...newDocs]);
        toast.success(`Added ${newDocs.length} documentation file${newDocs.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Failed to select documentation files:', error);
      toast.error('Failed to select files');
    } finally {
      setSelecting(false);
    }
  };

  const handleRemove = (index: number) => {
    const updated = documentation.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Documentation Files</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectFiles}
          disabled={selecting}
        >
          <File className="h-4 w-4 mr-2" />
          {selecting ? 'Selecting...' : 'Select Files'}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Select documentation files to include with this skill. Files will be copied to the skill's
        references/ directory.
      </p>

      {documentation.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8 border rounded-md border-dashed">
          No documentation files added yet. Click "Select Files" to add documentation.
        </div>
      ) : (
        <div className="space-y-2">
          {documentation.map((doc, index) => (
            <Card key={`${doc.filename}-${index}`} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{doc.filename}</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {doc.originalPath && (
                <p className="text-xs text-muted-foreground mt-1 ml-6 truncate">
                  {doc.originalPath}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
