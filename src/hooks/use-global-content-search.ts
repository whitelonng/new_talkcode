import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { repositoryService } from '@/services/repository-service';

export interface SearchResult {
  filePath: string;
  matches: {
    lineNumber: number;
    lineContent: string;
  }[];
}

export function useGlobalContentSearch(repositoryPath: string | null) {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const executeSearch = useCallback(async () => {
    if (!(repositoryPath && searchQuery)) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await repositoryService.searchFileContent(searchQuery, repositoryPath);
      setSearchResults(results);
    } catch (error) {
      logger.error('Failed to search content:', error);
      toast.error('Failed to search content.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [repositoryPath, searchQuery]);

  const toggleSearchVisibility = useCallback(() => {
    setIsSearchVisible((prev) => !prev);
  }, []);

  const resetSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  return {
    isSearchVisible,
    searchResults,
    searchQuery,
    isLoading,
    setSearchQuery,
    executeSearch,
    toggleSearchVisibility,
    setIsSearchVisible,
    resetSearch,
  };
}
