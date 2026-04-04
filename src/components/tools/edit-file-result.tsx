import { Badge } from '@/components/ui/badge';
import { timedMethod } from '@/lib/timer';

// Maximum lines for LCS diff computation to prevent O(m×n) memory explosion
const MAX_LINES_FOR_DIFF = 2000;

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'context';
  content: string;
  lineNumber?: number;
  originalLineNumber?: number;
  newLineNumber?: number;
}

interface EditFileResultProps {
  filePath: string;
  originalContent: string;
  newContent: string;
}

function computeLCS(
  originalLines: string[],
  modifiedLines: string[]
): Array<{
  content: string;
  originalIndex: number;
  modifiedIndex: number;
}> {
  const m = originalLines.length;
  const n = modifiedLines.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const prevRow = dp[i - 1];
      const currRow = dp[i];
      if (!currRow) continue;

      const prevCell = prevRow?.[j - 1];
      const topCell = prevRow?.[j];
      const leftCell = currRow[j - 1];

      if (originalLines[i - 1] === modifiedLines[j - 1]) {
        currRow[j] = (prevCell ?? 0) + 1;
      } else {
        currRow[j] = Math.max(topCell ?? 0, leftCell ?? 0);
      }
    }
  }

  const lcs: Array<{ content: string; originalIndex: number; modifiedIndex: number }> = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    const originalLine = originalLines[i - 1];
    const modifiedLine = modifiedLines[j - 1];
    const topCell = dp[i - 1]?.[j] ?? 0;
    const leftCell = dp[i]?.[j - 1] ?? 0;

    if (originalLine === modifiedLine) {
      lcs.unshift({
        content: originalLine ?? '',
        originalIndex: i - 1,
        modifiedIndex: j - 1,
      });
      i--;
      j--;
    } else if (topCell > leftCell) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

function generateDiff(
  original: string,
  modified: string
): { diff: DiffLine[]; isTooLarge: boolean } {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  // Find common prefix
  let prefixSize = 0;
  while (
    prefixSize < originalLines.length &&
    prefixSize < modifiedLines.length &&
    originalLines[prefixSize] === modifiedLines[prefixSize]
  ) {
    prefixSize++;
  }

  // Find common suffix
  let suffixSize = 0;
  while (
    suffixSize < originalLines.length - prefixSize &&
    suffixSize < modifiedLines.length - prefixSize &&
    originalLines[originalLines.length - 1 - suffixSize] ===
      modifiedLines[modifiedLines.length - 1 - suffixSize]
  ) {
    suffixSize++;
  }

  const midOriginalLines = originalLines.slice(prefixSize, originalLines.length - suffixSize);
  const midModifiedLines = modifiedLines.slice(prefixSize, modifiedLines.length - suffixSize);

  // Check if the modified part is too large
  if (
    midOriginalLines.length > MAX_LINES_FOR_DIFF ||
    midModifiedLines.length > MAX_LINES_FOR_DIFF
  ) {
    return { diff: [], isTooLarge: true };
  }

  const lcs = computeLCS(midOriginalLines, midModifiedLines);

  let originalIndex = 0;
  let modifiedIndex = 0;
  const midDiff: DiffLine[] = [];

  for (const line of lcs) {
    while (originalIndex < line.originalIndex) {
      midDiff.push({
        type: 'removed',
        content: midOriginalLines[originalIndex] ?? '',
        originalLineNumber: prefixSize + originalIndex + 1,
      });
      originalIndex++;
    }

    while (modifiedIndex < line.modifiedIndex) {
      midDiff.push({
        type: 'added',
        content: midModifiedLines[modifiedIndex] ?? '',
        newLineNumber: prefixSize + modifiedIndex + 1,
      });
      modifiedIndex++;
    }

    midDiff.push({
      type: 'unchanged',
      content: line.content,
      originalLineNumber: prefixSize + line.originalIndex + 1,
      newLineNumber: prefixSize + line.modifiedIndex + 1,
    });
    originalIndex++;
    modifiedIndex++;
  }

  while (originalIndex < midOriginalLines.length) {
    midDiff.push({
      type: 'removed',
      content: midOriginalLines[originalIndex] ?? '',
      originalLineNumber: prefixSize + originalIndex + 1,
    });
    originalIndex++;
  }

  while (modifiedIndex < midModifiedLines.length) {
    midDiff.push({
      type: 'added',
      content: midModifiedLines[modifiedIndex] ?? '',
      newLineNumber: prefixSize + modifiedIndex + 1,
    });
    modifiedIndex++;
  }

  // Combine prefix (as unchanged), midDiff, and suffix (as unchanged)
  const fullDiff: DiffLine[] = [];

  // Add prefix
  for (let i = 0; i < prefixSize; i++) {
    fullDiff.push({
      type: 'unchanged',
      content: originalLines[i] ?? '',
      originalLineNumber: i + 1,
      newLineNumber: i + 1,
    });
  }

  // Add midDiff
  fullDiff.push(...midDiff);

  // Add suffix
  for (let i = 0; i < suffixSize; i++) {
    const originalIdx = originalLines.length - suffixSize + i;
    const modifiedIdx = modifiedLines.length - suffixSize + i;
    fullDiff.push({
      type: 'unchanged',
      content: originalLines[originalIdx] ?? '',
      originalLineNumber: originalIdx + 1,
      newLineNumber: modifiedIdx + 1,
    });
  }

  const contextLines = 3;
  let inChangeSection = false;
  let distanceFromChange = 0;
  const diff: DiffLine[] = [];

  for (let i = 0; i < fullDiff.length; i++) {
    const line = fullDiff[i];
    if (!line) continue;

    const isChangedLine = line.type === 'added' || line.type === 'removed';

    if (isChangedLine) {
      if (!inChangeSection && i > 0) {
        const contextStart = Math.max(0, i - contextLines);
        for (let j = contextStart; j < i; j++) {
          const contextLine = fullDiff[j];
          if (contextLine?.type === 'unchanged' || contextLine?.type === 'context') {
            diff.push({
              type: 'context',
              content: contextLine.content ?? '',
              lineNumber:
                contextLine.originalLineNumber ||
                contextLine.newLineNumber ||
                contextLine.lineNumber,
              originalLineNumber: contextLine.originalLineNumber,
              newLineNumber: contextLine.newLineNumber,
            });
          }
        }
      }

      diff.push(line);
      inChangeSection = true;
      distanceFromChange = 0;
    } else if (inChangeSection) {
      if (line.type === 'unchanged') {
        distanceFromChange++;

        if (distanceFromChange <= contextLines) {
          diff.push({
            type: 'context',
            content: line.content ?? '',
            lineNumber: line.originalLineNumber || line.newLineNumber || line.lineNumber,
            originalLineNumber: line.originalLineNumber,
            newLineNumber: line.newLineNumber,
          });
        } else {
          inChangeSection = false;

          if (i < fullDiff.length - 1) {
            diff.push({
              type: 'context',
              content: '...',
              lineNumber: -1,
            });
          }
        }
      } else {
        diff.push(line);
      }
    }
  }

  return { diff, isTooLarge: false };
}

export function EditFileResult({ filePath, originalContent, newContent }: EditFileResultProps) {
  const fileName = filePath.split('/').pop() || filePath;
  const originalLineCount = originalContent.split('\n').length;
  const newLineCount = newContent.split('\n').length;

  // Only compute diff for reasonably sized changes
  const { diff, isTooLarge } = generateDiff(originalContent, newContent);

  // For large files, estimate changes by comparing line counts
  const addedLines = isTooLarge
    ? Math.max(0, newLineCount - originalLineCount)
    : diff.filter((line) => line.type === 'added').length;
  const removedLines = isTooLarge
    ? Math.max(0, originalLineCount - newLineCount)
    : diff.filter((line) => line.type === 'removed').length;

  return (
    <div className="border rounded-md bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 flex-1">
          <span className="font-medium text-sm">{fileName}</span>
          {removedLines > 0 && (
            <Badge variant="destructive" className="text-xs">
              -{removedLines}
            </Badge>
          )}
          {addedLines > 0 && (
            <Badge variant="default" className="text-xs bg-green-600">
              +{addedLines}
            </Badge>
          )}
        </div>
      </div>

      {/* Diff Content */}
      {isTooLarge && (
        <div className="p-4 text-sm text-muted-foreground">
          <p>
            File too large for detailed diff view ({originalLineCount.toLocaleString()} →{' '}
            {newLineCount.toLocaleString()} lines)
          </p>
          <p className="mt-1">Diff computation skipped to prevent performance issues.</p>
        </div>
      )}
      {!isTooLarge && (
        <div className="max-h-96 overflow-auto font-mono text-sm">
          {diff.map((line, index) => {
            const isEllipsis = line.content === '...' && line.lineNumber === -1;

            return (
              <div
                key={`${line.lineNumber}-${line.type}-${index}`}
                className={`flex ${
                  line.type === 'added'
                    ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                    : line.type === 'removed'
                      ? 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'
                      : line.type === 'context'
                        ? 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300'
                }`}
              >
                {/* Line numbers */}
                <div className="flex flex-none border-r bg-gray-50 dark:bg-gray-800">
                  {line.type === 'removed' && (
                    <div className="w-10 px-2 py-1 text-red-500 text-xs text-right select-none">
                      {line.originalLineNumber}
                    </div>
                  )}
                  {line.type === 'added' && (
                    <div className="w-10 px-2 py-1 text-green-500 text-xs text-right select-none">
                      {line.newLineNumber}
                    </div>
                  )}
                  {line.type === 'context' && !isEllipsis && (
                    <div className="w-10 px-2 py-1 text-gray-400 text-xs text-right select-none">
                      {line.originalLineNumber || line.newLineNumber}
                    </div>
                  )}
                  {line.type === 'unchanged' && (
                    <div className="w-10 px-2 py-1 text-gray-400 text-xs text-right select-none">
                      {line.lineNumber}
                    </div>
                  )}
                  {isEllipsis && (
                    <div className="w-10 px-2 py-1 text-gray-400 text-xs text-right select-none">
                      ...
                    </div>
                  )}
                </div>

                {/* Line marker */}
                <div className="w-6 px-1 py-1 text-xs select-none">
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
      )}
    </div>
  );
}
