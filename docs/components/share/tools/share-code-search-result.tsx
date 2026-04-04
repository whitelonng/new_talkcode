// docs/components/share/tools/share-code-search-result.tsx
// CodeSearch tool result renderer for share page
import { Search } from 'lucide-react';
import type { CodeSearchOutput } from '@/types/share-tools';

interface ShareCodeSearchResultProps {
  output: CodeSearchOutput;
}

export function ShareCodeSearchResult({ output }: ShareCodeSearchResultProps) {
  const { success, result, error } = output;

  // Parse the result to extract match count
  const matchCount = result.match(/^Found (\d+) matches:/)?.[1] || '0';

  // Display error if not successful
  if (!success) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
          <Search className="h-4 w-4" />
          <span className="font-medium">Search Failed</span>
        </div>
        <pre className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
          {error || 'Unknown error'}
        </pre>
      </div>
    );
  }

  // Display "No matches found" message
  if (result === 'No matches found') {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Search className="h-4 w-4" />
          <span className="font-medium">No matches found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <Search className="h-4 w-4 text-blue-500" />
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
          Found {matchCount} matches
        </span>
      </div>

      {/* Results */}
      <div className="max-h-96 overflow-auto font-mono text-xs p-4 bg-gray-50 dark:bg-gray-900">
        <pre className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
          {result}
        </pre>
      </div>
    </div>
  );
}
