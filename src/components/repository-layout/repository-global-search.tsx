import type React from 'react';
import { memo } from 'react';
import { GlobalContentSearch } from '@/components/search/global-content-search';
import { GlobalFileSearch } from '@/components/search/global-file-search';
import type { FileNode } from '@/types/file-system';

interface RepositoryGlobalSearchProps {
  getRecentFiles: () => Promise<FileNode[]>;
  isFileSearchOpen: boolean;
  onCloseFileSearch: () => void;
  onFileSelect: (filePath: string, lineNumber?: number) => void;
  onSearchFiles: (query: string) => Promise<FileNode[]>;
  repositoryPath: string | null;
  isContentSearchVisible: boolean;
  onToggleContentSearch: () => void;
  contentSearchInputRef: React.RefObject<HTMLInputElement | null>;
  showContentSearch: boolean;
}

export const RepositoryGlobalSearch = memo(function RepositoryGlobalSearch({
  getRecentFiles,
  isFileSearchOpen,
  onCloseFileSearch,
  onFileSelect,
  onSearchFiles,
  repositoryPath,
  isContentSearchVisible,
  onToggleContentSearch,
  contentSearchInputRef,
  showContentSearch,
}: RepositoryGlobalSearchProps) {
  return (
    <>
      <GlobalFileSearch
        getRecentFiles={getRecentFiles}
        isOpen={isFileSearchOpen}
        onClose={onCloseFileSearch}
        onFileSelect={onFileSelect}
        onSearch={onSearchFiles}
        repositoryPath={repositoryPath}
      />

      {showContentSearch && (
        <GlobalContentSearch
          inputRef={contentSearchInputRef}
          isSearchVisible={isContentSearchVisible}
          onFileSelect={onFileSelect}
          repositoryPath={repositoryPath}
          toggleSearchVisibility={onToggleContentSearch}
        />
      )}
    </>
  );
});
