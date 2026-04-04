// src/components/chat/file-picker.tsx

import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { repositoryService } from '@/services/repository-service';
import type { FileNode } from '@/types/file-system';

interface FilePickerProps {
  repositoryPath?: string;
  onFileSelect: (filePath: string) => void;
  onClose: () => void;
  searchQuery: string;
  position: { top: number; left: number };
}

interface FileSearchResult {
  name: string;
  path: string;
  is_directory: boolean;
  score: number;
}

export function FilePicker({
  repositoryPath,
  onFileSelect,
  onClose,
  searchQuery,
  position,
}: FilePickerProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileNode[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadFiles = useCallback(async () => {
    if (!repositoryPath) return;

    setLoading(true);
    try {
      // Get flat list of all files for better search performance
      const allFiles = await repositoryService.getFlatFileList(repositoryPath);
      setFiles(allFiles);
    } catch (error) {
      logger.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  }, [repositoryPath]);

  const filterFiles = useCallback(
    async (query: string) => {
      if (!repositoryPath) {
        setFilteredFiles([]);
        return;
      }

      if (!query.trim()) {
        setFilteredFiles(files.slice(0, 50));
        setSelectedIndex(0);
        return;
      }

      try {
        const results: FileSearchResult[] = await invoke('search_files_fast', {
          query,
          rootPath: repositoryPath,
          maxResults: 20,
        });

        const mappedFiles: FileNode[] = results.map((result) => ({
          name: result.name,
          path: result.path,
          is_directory: result.is_directory,
        }));

        setFilteredFiles(mappedFiles);
        setSelectedIndex(0);
      } catch (error) {
        logger.error('Failed to search files:', error);
        setFilteredFiles([]);
      }
    },
    [repositoryPath, files]
  );

  const handleFileSelect = useCallback(
    (file: FileNode) => {
      if (!file.is_directory) {
        onFileSelect(file.path);
        onClose();
      }
    },
    [onFileSelect, onClose]
  );

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    filterFiles(searchQuery);
  }, [searchQuery, filterFiles]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < filteredFiles.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredFiles.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredFiles[selectedIndex]) {
            handleFileSelect(filteredFiles[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredFiles, selectedIndex, onClose, handleFileSelect]);

  const getFileIcon = (fileName: string) => {
    const extension = repositoryService.getFileExtension(fileName);
    const iconMap: { [key: string]: string } = {
      js: '🟨',
      jsx: '🟨',
      ts: '🟦',
      tsx: '🟦',
      py: '🐍',
      rs: '🦀',
      go: '🐹',
      java: '☕',
      html: '🌐',
      css: '🎨',
      json: '📋',
      md: '📝',
    };

    return <span className="mr-1 text-sm">{iconMap[extension] || '📄'}</span>;
  };

  if (!repositoryPath) {
    return (
      <div
        className="fixed z-50 w-96 max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
        ref={containerRef}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="p-3 text-center text-muted-foreground text-sm">No repository opened</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="fixed z-50 w-96 max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
        ref={containerRef}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="p-3 text-center text-muted-foreground text-sm">Loading files...</div>
      </div>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <div
        className="fixed z-50 w-96 max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
        ref={containerRef}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="p-3 text-center text-muted-foreground text-sm">
          {searchQuery.trim() ? 'No files found' : 'No files available'}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50 max-h-64 w-96 max-w-md overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
      ref={containerRef}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="p-2">
        <div className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-muted-foreground text-xs">
          {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''} found
        </div>
        {filteredFiles.map((file, index) => (
          // biome-ignore lint/a11y/useSemanticElements: Complex flex layout requires div, has proper keyboard handling
          <div
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700',
              index === selectedIndex &&
                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
            )}
            key={file.path}
            onClick={() => handleFileSelect(file)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFileSelect(file);
              }
            }}
            role="button"
            tabIndex={0}
          >
            {getFileIcon(file.name)}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{file.name}</div>
              <div className="truncate text-muted-foreground text-xs">
                {repositoryService.getRelativePath(file.path, repositoryPath)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
