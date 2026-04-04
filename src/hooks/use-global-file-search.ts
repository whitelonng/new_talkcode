// src/hooks/use-global-file-search.ts
import { useCallback, useState } from 'react';

export function useGlobalFileSearch(
  onFileSelect?: (filePath: string, lineNumber?: number) => void
) {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleFileSelect = useCallback(
    (filePath: string, lineNumber?: number) => {
      onFileSelect?.(filePath, lineNumber);
      setIsOpen(false);
    },
    [onFileSelect]
  );

  return {
    isOpen,
    openSearch,
    closeSearch,
    handleFileSelect,
  };
}
