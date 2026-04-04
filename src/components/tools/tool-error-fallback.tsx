import { logger } from '@/lib/logger';
import { UnifiedToolResult } from './unified-tool-result';

interface ToolErrorFallbackProps {
  toolName: string;
  errorType: 'call' | 'result';
  error: Error;
  output?: unknown;
  input?: Record<string, unknown>;
}

export function ToolErrorFallback({
  toolName,
  errorType,
  error,
  output,
  input,
}: ToolErrorFallbackProps) {
  const isCallError = errorType === 'call';

  logger.error(`Error rendering tool ${errorType} UI:`, error);

  return (
    <UnifiedToolResult toolName={toolName} input={input || {}} output={output} isError={true}>
      <div className="text-red-600 dark:text-red-400 mb-2">
        Error rendering tool {isCallError ? 'call' : 'result'}:{' '}
        {error instanceof Error ? error.message : 'Unknown error'}
      </div>
      {!isCallError && output ? (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <pre className="overflow-auto">
            Raw Output:{' '}
            {
              (() => {
                try {
                  return JSON.stringify(output, null, 2);
                } catch {
                  return String(output);
                }
              })() as React.ReactNode
            }
          </pre>
        </div>
      ) : null}
    </UnifiedToolResult>
  );
}
