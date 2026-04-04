import { Check, FileText, MessageSquare, X } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-locale';

interface FileDiffPreviewProps {
  filePath: string;
  originalContent: string;
  newContent: string;
  onApprove: () => void;
  onReject: (feedback: string) => void;
  onAllowAll?: () => void; // Allow all edits in this conversation
  operation: 'edit' | 'write';
}

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
  let i = m,
    j = n;

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

export function FileDiffPreview({
  filePath,
  originalContent,
  newContent,
  onApprove,
  onReject,
  onAllowAll,
  operation,
}: FileDiffPreviewProps) {
  const locale = useTranslation();
  const [feedback, setFeedback] = useState('');

  const fileName = filePath.split('/').pop() || filePath;
  const diff = generateDiff(originalContent, newContent);

  const addedLines = diff.filter((line) => line.type === 'added').length;
  const removedLines = diff.filter((line) => line.type === 'removed').length;

  const handleReject = () => {
    // Only reject with feedback if feedback is provided
    if (feedback.trim()) {
      onReject(feedback);
    }
  };

  return (
    <Card className="@container w-full mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-lg">
                {operation === 'edit'
                  ? locale.FileDiffPreview.editTitle
                  : locale.FileDiffPreview.writeTitle}
              </CardTitle>
              <CardDescription className="font-mono text-sm">{fileName}</CardDescription>
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
      </CardHeader>

      <CardContent className="space-y-4">
        {/* File path */}
        <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono text-gray-700 dark:text-gray-300">
          {filePath}
        </div>

        {/* Diff display */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b text-sm font-medium text-gray-700 dark:text-gray-300">
            {locale.FileDiffPreview.changes}
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {diff.map((line, index) => {
              const isEllipsis = line.content === '...' && line.lineNumber === -1;

              return (
                <div
                  key={`${line.lineNumber}-${line.type}-${index}`}
                  className={`flex font-mono text-sm ${
                    line.type === 'added'
                      ? 'bg-green-50 text-green-800'
                      : line.type === 'removed'
                        ? 'bg-red-50 text-red-800'
                        : line.type === 'context'
                          ? 'bg-gray-50 text-gray-600'
                          : 'bg-white text-gray-700'
                  }`}
                >
                  <div className="flex flex-none border-r bg-gray-50">
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

        {/* Feedback section - always visible */}
        <Alert className="w-full">
          <MessageSquare className="h-4 w-4" />
          <AlertDescription className="w-full">
            <div className="space-y-2 w-full">
              <p className="text-sm font-medium">{locale.FileDiffPreview.feedbackTitle}</p>
              <Textarea
                placeholder={locale.FileDiffPreview.feedbackPlaceholder}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[60px] w-full resize-y"
              />
            </div>
          </AlertDescription>
        </Alert>

        <Separator />

        {/* Action buttons */}
        <div className="flex flex-col gap-2 @xl:flex-row @xl:justify-end @xl:gap-3">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={!feedback.trim()}
            className="flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4 flex-shrink-0" />
            {locale.FileDiffPreview.submitFeedback}
          </Button>
          {onAllowAll && (
            <Button
              variant="outline"
              onClick={onAllowAll}
              className="flex items-center justify-center gap-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
            >
              <Check className="h-4 w-4 flex-shrink-0" />
              {locale.FileDiffPreview.allowAllEdits}
            </Button>
          )}
          <Button
            onClick={onApprove}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 flex-shrink-0" />
            {locale.FileDiffPreview.approveAndApply}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
