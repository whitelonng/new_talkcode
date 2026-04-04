// src/components/file-search.tsx

import { File, Folder, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { FileNode } from '@/types/file-system';

interface FileSearchProps {
  onSearch: (query: string) => Promise<FileNode[]>;
  onFileSelect: (filePath: string) => void;
  className?: string;
}

export function FileSearch({ onSearch, onFileSelect, className }: FileSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const searchFiles = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const searchResults = await onSearch(query);
        setResults(searchResults);
      } catch (error) {
        logger.error('Search error:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchFiles, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query, onSearch]);

  const handleFileClick = (filePath: string, isDirectory: boolean) => {
    if (!isDirectory) {
      onFileSelect(filePath);
      setQuery('');
      setResults([]);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
        <Input
          className="pl-10"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files..."
          type="text"
          value={query}
        />
      </div>

      {(results.length > 0 || isSearching) && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-white shadow-lg dark:bg-gray-950">
          {isSearching ? (
            <div className="p-3 text-center text-gray-500">
              <div className="mx-auto mb-2 h-4 w-4 animate-spin rounded-full border-blue-600 border-b-2" />
              Searching...
            </div>
          ) : (
            <div>
              {results.map((file) => (
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center border-0 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                  key={file.path}
                  onClick={() => handleFileClick(file.path, file.is_directory)}
                >
                  {file.is_directory ? (
                    <Folder className="mr-2 h-4 w-4 flex-shrink-0 text-blue-600" />
                  ) : (
                    <File className="mr-2 h-4 w-4 flex-shrink-0 text-gray-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{file.name}</p>
                    <p className="truncate text-gray-500 text-xs">{file.path}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
