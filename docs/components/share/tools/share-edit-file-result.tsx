// docs/components/share/tools/share-edit-file-result.tsx
// EditFile tool result renderer for share page

import { FileEdit } from 'lucide-react';
import type { EditFileOutput } from '@/types/share-tools';

interface ShareEditFileResultProps {
  output: EditFileOutput;
}

export function ShareEditFileResult({ output }: ShareEditFileResultProps) {
  const { file_path, diff, stats } = output;
  const fileName = file_path.split('/').pop() || file_path;

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
        <FileEdit className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{fileName}</span>
        {stats.removed > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
            -{stats.removed}
          </span>
        )}
        {stats.added > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            +{stats.added}
          </span>
        )}
      </div>

      {/* Diff Content */}
      <div className="max-h-96 overflow-auto font-mono text-xs">
        {diff.map((line, index) => {
          const isEllipsis = line.content === '...';
          
          return (
            <div
              key={`${line.lineNumber}-${line.type}-${index}`}
              className={`flex ${
                line.type === 'added'
                  ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                  : line.type === 'removed'
                    ? 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'
                    : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400'
              }`}
            >
              {/* Line numbers */}
              <div className="flex flex-none border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                {line.type === 'removed' && (
                  <div className="w-10 px-2 py-1 text-red-500 text-right select-none">
                    {line.originalLineNumber}
                  </div>
                )}
                {line.type === 'added' && (
                  <div className="w-10 px-2 py-1 text-green-500 text-right select-none">
                    {line.newLineNumber}
                  </div>
                )}
                {line.type === 'unchanged' && (
                  <div className="w-10 px-2 py-1 text-gray-400 text-right select-none">
                    {line.originalLineNumber || line.newLineNumber}
                  </div>
                )}
                {isEllipsis && (
                  <div className="w-10 px-2 py-1 text-gray-400 text-right select-none">
                    ...
                  </div>
                )}
              </div>

              {/* Line marker */}
              <div className="w-6 px-1 py-1 select-none text-center">
                {line.type === 'added'
                  ? '+'
                  : line.type === 'removed'
                    ? '-'
                    : isEllipsis
                      ? '⋮'
                      : ' '}
              </div>

              {/* Line content */}
              <div
                className={`flex-1 px-2 py-1 whitespace-pre-wrap break-all ${
                  isEllipsis ? 'text-gray-400 text-center italic' : ''
                }`}
              >
                {line.content || '\u00A0'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
