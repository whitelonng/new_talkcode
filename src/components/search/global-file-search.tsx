// src/components/global-file-search.tsx

import { File, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { FileNode } from '@/types/file-system';

interface GlobalFileSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<FileNode[]>;
  onFileSelect: (filePath: string, lineNumber?: number) => void;
  repositoryPath?: string | null;
  getRecentFiles?: () => Promise<FileNode[]>;
}

/**
 * Parse file query to extract filename and optional line number
 * Supports format: filename:lineNumber (e.g., "test.cpp:82")
 */
function parseFileQuery(input: string): { query: string; lineNumber?: number } {
  const trimmed = input.trim();
  // Match pattern: anything followed by :number at the end
  const match = trimmed.match(/^(.+):(\d+)$/);
  if (match && match[1] && match[2]) {
    return {
      query: match[1],
      lineNumber: parseInt(match[2], 10),
    };
  }
  return { query: trimmed };
}

export function GlobalFileSearch({
  isOpen,
  onClose,
  onSearch,
  onFileSelect,
  repositoryPath,
  getRecentFiles,
}: GlobalFileSearchProps) {
  const t = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileNode[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [parsedLineNumber, setParsedLineNumber] = useState<number | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Parse query into keywords for display purposes only
  const keywords = useMemo(() => {
    return query
      .trim()
      .toLowerCase()
      .split(/[\s/]+/) // Split by whitespace or forward slash
      .filter((keyword) => keyword.length > 0);
  }, [query]);

  const handleFileSelect = useCallback(
    (file: FileNode) => {
      onFileSelect(file.path, parsedLineNumber);
      onClose();
    },
    [onFileSelect, onClose, parsedLineNumber]
  );

  // Reset state when dialog opens/closes and load recent files
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setParsedLineNumber(undefined);

      // Load recent files if getRecentFiles is provided
      if (getRecentFiles) {
        getRecentFiles()
          .then(setRecentFiles)
          .catch((error) => {
            logger.error('Failed to load recent files:', error);
            setRecentFiles([]);
          });
      }

      // Focus the input when dialog opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, getRecentFiles]);

  // Note: Matching and scoring logic has been moved to Rust backend for better performance

  // Search files with debouncing
  useEffect(() => {
    const searchFiles = async () => {
      // Parse the query to extract filename and optional line number
      const { query: searchQuery, lineNumber } = parseFileQuery(query);
      setParsedLineNumber(lineNumber);

      if (!searchQuery.trim()) {
        setResults([]);
        setSelectedIndex(0);
        return;
      }

      setIsSearching(true);
      try {
        // Get all search results from the high-performance Rust backend
        // The backend now handles all keyword matching, filtering, and scoring
        const searchResults = await onSearch(searchQuery);

        // Filter out directories if needed (most file searches should only show files)
        const fileResults = searchResults.filter((file) => !file.is_directory);

        setResults(fileResults);
        setSelectedIndex(0);
      } catch (error) {
        logger.error('Search error:', error);
        setResults([]);
        setSelectedIndex(0);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchFiles, 200); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query, onSearch]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Determine which list to use for navigation
      const activeList = query.trim() ? results : recentFiles;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < activeList.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeList[selectedIndex]) {
            handleFileSelect(activeList[selectedIndex]);
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
  }, [isOpen, query, results, recentFiles, selectedIndex, onClose, handleFileSelect]);

  // Scroll selected item into view
  useEffect(() => {
    const activeList = query.trim() ? results : recentFiles;
    if (listRef.current && activeList.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex, query, results, recentFiles]);

  const getRelativePath = (fullPath: string) => {
    if (!repositoryPath) return fullPath;
    return fullPath.replace(repositoryPath, '').replace(/^\//, '');
  };

  const highlightMultipleKeywords = (text: string, keywords: string[]) => {
    if (keywords.length === 0) return text;

    // Create a combined regex pattern for all keywords
    const escapedKeywords = keywords.map((keyword) =>
      keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const pattern = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');

    const parts = text.split(pattern);
    let keyCounter = 0;

    return (
      <>
        {parts.map((part) => {
          const isKeyword = keywords.some(
            (keyword) => part.toLowerCase() === keyword.toLowerCase()
          );
          const key = `${isKeyword ? 'match' : 'text'}-${keyCounter++}`;

          if (isKeyword) {
            return (
              <span className="bg-yellow-200 font-semibold dark:bg-yellow-700" key={key}>
                {part}
              </span>
            );
          }
          return <span key={key}>{part}</span>;
        })}
      </>
    );
  };

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[600px]" showCloseButton={false}>
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">{t.Settings.search.searchFiles}</DialogTitle>

        <div className="flex h-[500px] flex-col">
          {/* Header */}
          <div className="flex items-center border-b bg-gray-50 px-4 py-3 dark:bg-gray-800">
            <div className="relative flex-1">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
              <Input
                className="border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0"
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.Settings.search.searchFilesPlaceholder}
                ref={inputRef}
                type="text"
                value={query}
              />
            </div>
            <button
              type="button"
              className="ml-2 rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto" ref={listRef}>
            {query.trim() ? (
              isSearching ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
                  <p>{t.Settings.search.searchingFiles}</p>
                  {keywords.length > 1 && (
                    <p className="mt-2 text-xs">
                      {t.Settings.search.lookingFor} {keywords.map((k) => `"${k}"`).join(', ')}
                    </p>
                  )}
                </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <File className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="mb-2 font-medium text-lg">{t.Settings.search.noFilesFound}</p>
                  <p className="text-sm">{t.Settings.search.tryDifferentTerm}</p>
                  {keywords.length > 1 && (
                    <p className="mt-2 text-orange-600 text-xs dark:text-orange-400">
                      {t.Settings.search.noFilesContainAllKeywords}{' '}
                      {keywords.map((k) => `"${k}"`).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  {results.map((file, index) => (
                    <button
                      type="button"
                      className={cn(
                        'flex w-full cursor-pointer items-center border-0 px-4 py-3 text-left transition-colors',
                        index === selectedIndex
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                      key={file.path}
                      onClick={() => handleFileSelect(file)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleFileSelect(file);
                        }
                      }}
                    >
                      <File className="mr-3 h-4 w-4 flex-shrink-0 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">
                          {highlightMultipleKeywords(file.name, keywords)}
                        </p>
                        <p className="truncate text-gray-500 text-xs">
                          {getRelativePath(file.path)}
                        </p>
                      </div>
                      {index === selectedIndex && (
                        <div className="ml-2 text-gray-400 text-xs">
                          <kbd className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-700">
                            Enter
                          </kbd>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )
            ) : recentFiles.length > 0 ? (
              <div>
                <div className="border-b bg-gray-50 px-4 py-2 dark:bg-gray-800">
                  <p className="font-medium text-gray-700 text-sm dark:text-gray-300">
                    {t.Settings.search.recentFiles}
                  </p>
                </div>
                <div className="py-2">
                  {recentFiles.map((file, index) => (
                    <button
                      type="button"
                      className={cn(
                        'flex w-full cursor-pointer items-center border-0 px-4 py-3 text-left transition-colors',
                        index === selectedIndex
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                      key={file.path}
                      onClick={() => handleFileSelect(file)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleFileSelect(file);
                        }
                      }}
                    >
                      <File className="mr-3 h-4 w-4 flex-shrink-0 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{file.name}</p>
                        <p className="truncate text-gray-500 text-xs">
                          {getRelativePath(file.path)}
                        </p>
                      </div>
                      {index === selectedIndex && (
                        <div className="ml-2 text-gray-400 text-xs">
                          <kbd className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-700">
                            Enter
                          </kbd>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Search className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p className="mb-2 font-medium text-lg">{t.Settings.search.searchFiles}</p>
                <p className="text-sm">{t.Settings.search.typeToSearchFiles}</p>
                <p className="mt-2 text-blue-600 text-sm dark:text-blue-400">
                  {t.Settings.search.useSpacesForMultipleKeywords}
                </p>
                <div className="mt-4 space-y-1 text-xs">
                  <p>
                    <kbd className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-700">
                      ↑↓
                    </kbd>{' '}
                    {t.Settings.search.navigate}
                  </p>
                  <p>
                    <kbd className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-700">
                      Enter
                    </kbd>{' '}
                    {t.Settings.search.openFile}
                  </p>
                  <p>
                    <kbd className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-700">
                      Esc
                    </kbd>{' '}
                    {t.Settings.search.cancel}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="flex justify-between border-t bg-gray-50 px-4 py-2 text-gray-500 text-xs dark:bg-gray-800">
              <span>
                {results.length} {t.Settings.search.filesFound}
                {keywords.length > 1 && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400">
                    {t.Settings.search.matchingAll} {keywords.map((k) => `"${k}"`).join(', ')})
                  </span>
                )}
              </span>
              <span>{t.Settings.search.useArrowsToNavigate}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
