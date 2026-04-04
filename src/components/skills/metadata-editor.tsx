/**
 * Metadata Editor Component
 *
 * Allows editing key-value pairs for frontmatter.metadata
 * per Agent Skills Specification
 */

import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MetadataEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

export function MetadataEditor({ value, onChange }: MetadataEditorProps) {
  const metadataId = useId();
  const entries = Object.entries(value || {});

  const handleAdd = () => {
    const newKey = `key${entries.length + 1}`;
    onChange({
      ...value,
      [newKey]: '',
    });
  };

  const handleRemove = (key: string) => {
    const newValue = { ...value };
    delete newValue[key];
    onChange(newValue);
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;

    // Check if new key already exists
    if (newKey in value && newKey !== oldKey) {
      return; // Prevent duplicate keys
    }

    const newValue = { ...value };
    const val = newValue[oldKey];
    delete newValue[oldKey];

    if (newKey.trim()) {
      newValue[newKey] = val || '';
    }

    onChange(newValue);
  };

  const handleValueChange = (key: string, newValue: string) => {
    onChange({
      ...value,
      [key]: newValue,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={metadataId}>Metadata (Key-Value Pairs)</Label>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Field
        </Button>
      </div>

      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
            No metadata fields. Click "Add Field" to add custom metadata.
          </div>
        ) : (
          entries.map(([key, val]) => (
            <div key={key} className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  placeholder="Key (e.g., author, version)"
                  value={key}
                  onChange={(e) => handleKeyChange(key, e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Value"
                  value={val}
                  onChange={(e) => handleValueChange(key, e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(key)}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Tip:</strong> Use namespaced keys for organization (e.g., "talkcody.version",
          "author.email")
        </p>
        <p>Common metadata fields: author, version, homepage, repository, tags</p>
      </div>
    </div>
  );
}
