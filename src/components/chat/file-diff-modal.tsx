import { FileText, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'context';
  content: string;
  lineNumber?: number;
  originalLineNumber?: number;
  newLineNumber?: number;
}

interface LCSLine {
  content: string;
  originalIndex: number;
  modifiedIndex: number;
}

function computeLCS(originalLines: string[], modifiedLines: string[]): LCSLine[] {
  const m = originalLines.length;
  const n = modifiedLines.length;

  // Create DP table for LCS
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Fill DP table
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

  // Backtrack to find LCS
  const lcs: LCSLine[] = [];
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

function generateDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const diff: DiffLine[] = [];

  // Use a simple LCS (Longest Common Subsequence) algorithm for better diff
  const lcs = computeLCS(originalLines, modifiedLines);

  // Build diff from LCS
  let originalIndex = 0;
  let modifiedIndex = 0;
  const fullDiff: DiffLine[] = [];

  for (const line of lcs) {
    // Add removed lines
    while (originalIndex < line.originalIndex) {
      fullDiff.push({
        type: 'removed',
        content: originalLines[originalIndex] ?? '',
        originalLineNumber: originalIndex + 1,
      });
      originalIndex++;
    }

    // Add added lines
    while (modifiedIndex < line.modifiedIndex) {
      fullDiff.push({
        type: 'added',
        content: modifiedLines[modifiedIndex] ?? '',
        newLineNumber: modifiedIndex + 1,
      });
      modifiedIndex++;
    }

    // Add the matching line
    fullDiff.push({
      type: 'unchanged',
      content: line.content,
      originalLineNumber: line.originalIndex + 1,
      newLineNumber: line.modifiedIndex + 1,
    });
    originalIndex++;
    modifiedIndex++;
  }

  // Add remaining lines from original (removed)
  while (originalIndex < originalLines.length) {
    fullDiff.push({
      type: 'removed',
      content: originalLines[originalIndex] ?? '',
      originalLineNumber: originalIndex + 1,
    });
    originalIndex++;
  }

  // Add remaining lines from modified (added)
  while (modifiedIndex < modifiedLines.length) {
    fullDiff.push({
      type: 'added',
      content: modifiedLines[modifiedIndex] ?? '',
      newLineNumber: modifiedIndex + 1,
    });
    modifiedIndex++;
  }

  // Now, filter to show only changed sections with context
  const contextLines = 3; // Show 3 lines before and after changes
  let inChangeSection = false;
  let distanceFromChange = 0;
  const hasChanges = fullDiff.some((line) => line.type === 'added' || line.type === 'removed');

  if (!hasChanges) {
    // No changes, return a message
    return [
      {
        type: 'context' as const,
        content: 'No changes detected between original and modified content.',
        lineNumber: -1,
      },
    ];
  }

  for (let i = 0; i < fullDiff.length; i++) {
    const line = fullDiff[i];
    if (!line) continue;

    const isChangedLine = line.type === 'added' || line.type === 'removed';

    if (isChangedLine) {
      // If we're not currently in a change section, add context indicator
      if (!inChangeSection && i > 0) {
        // Add context lines before the change
        const contextStart = Math.max(0, i - contextLines);
        for (let j = contextStart; j < i; j++) {
          const contextLine = fullDiff[j];
          if (contextLine?.type === 'unchanged') {
            diff.push({
              type: 'context',
              content: contextLine.content ?? '',
              lineNumber: contextLine.originalLineNumber,
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
          // Still within context after change
          diff.push({
            type: 'context',
            content: line.content ?? '',
            lineNumber: line.originalLineNumber,
            originalLineNumber: line.originalLineNumber,
            newLineNumber: line.newLineNumber,
          });
        } else {
          // We've moved beyond the context range, end this change section
          inChangeSection = false;

          // Add ellipsis to indicate omitted lines if there are more lines
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

  return diff;
}

interface FileDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  originalContent: string;
  newContent: string;
}

export function FileDiffModal({
  open,
  onOpenChange,
  filePath,
  originalContent,
  newContent,
}: FileDiffModalProps) {
  const fileName = filePath.split('/').pop() || filePath;
  const diff = generateDiff(originalContent, newContent);

  const addedLines = diff.filter((line) => line.type === 'added').length;
  const removedLines = diff.filter((line) => line.type === 'removed').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-fit min-w-4/5 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <DialogTitle className="text-lg">File Changes</DialogTitle>
                <DialogDescription className="font-mono text-sm">{fileName}</DialogDescription>
              </div>
            </div>
            <div className="flex gap-2">
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
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* File path */}
          <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono text-gray-700 dark:text-gray-300">
            {filePath}
          </div>

          {/* Diff display */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b text-sm font-medium text-gray-700 dark:text-gray-300">
              Changes
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {diff.map((line, index) => {
                const isEllipsis = line.content === '...' && line.lineNumber === -1;

                return (
                  <div
                    key={`${line.lineNumber}-${line.type}-${index}`}
                    className={`flex font-mono text-sm ${
                      line.type === 'added'
                        ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                        : line.type === 'removed'
                          ? 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'
                          : line.type === 'context'
                            ? 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400'
                            : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex flex-none border-r bg-gray-50 dark:bg-gray-800">
                      {/* Line numbers */}
                      {line.type === 'removed' && (
                        <div className="w-12 px-2 py-1 text-red-500 text-xs text-right select-none">
                          {line.originalLineNumber}
                        </div>
                      )}
                      {line.type === 'added' && (
                        <div className="w-12 px-2 py-1 text-green-500 text-xs text-right select-none">
                          {line.newLineNumber}
                        </div>
                      )}
                      {line.type === 'context' && !isEllipsis && (
                        <div className="w-12 px-2 py-1 text-gray-400 text-xs text-right select-none">
                          {line.originalLineNumber || line.newLineNumber}
                        </div>
                      )}
                      {line.type === 'unchanged' && (
                        <div className="w-12 px-2 py-1 text-gray-400 text-xs text-right select-none">
                          {line.lineNumber}
                        </div>
                      )}
                      {isEllipsis && (
                        <div className="w-12 px-2 py-1 text-gray-400 text-xs text-right select-none">
                          ...
                        </div>
                      )}
                    </div>

                    <div className="w-8 px-1 py-1 text-xs select-none">
                      {line.type === 'added'
                        ? '+'
                        : line.type === 'removed'
                          ? '-'
                          : isEllipsis
                            ? '⋮'
                            : ' '}
                    </div>

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
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
