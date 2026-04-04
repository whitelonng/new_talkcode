import { CheckCircle2, Clock, Terminal, XCircle } from 'lucide-react';

interface ExecuteSkillScriptResultProps {
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time_ms: number;
  success: boolean;
  error?: string;
}

export function ExecuteSkillScriptResult({
  stdout,
  stderr,
  exit_code,
  execution_time_ms,
  success,
  error,
}: ExecuteSkillScriptResultProps) {
  const hasOutput = stdout || stderr || error;

  return (
    <div className="space-y-3">
      {/* Status Header */}
      <div className="flex items-center gap-3 text-sm">
        {success ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <span className="text-gray-700 dark:text-gray-300">
          {success ? 'Script executed successfully' : 'Script execution failed'}
        </span>
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Clock className="h-3 w-3" />
          {execution_time_ms}ms
        </span>
        {exit_code !== 0 && (
          <span className="text-gray-500 dark:text-gray-400">Exit code: {exit_code}</span>
        )}
      </div>

      {/* Output Display */}
      {hasOutput && (
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono border-l-4 border-gray-600 dark:bg-gray-950 dark:border-gray-700 w-full overflow-hidden">
          <div className="flex items-center gap-2 mb-3 text-sm">
            <Terminal className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <span className="text-gray-300 dark:text-gray-400">Output:</span>
          </div>

          {/* Standard Output */}
          {stdout && (
            <div className="mb-3">
              <div className="bg-gray-800 px-3 py-2 rounded max-h-60 overflow-auto dark:bg-gray-900">
                <pre className="text-sm text-gray-100 whitespace-pre-wrap break-words dark:text-gray-200">
                  {stdout}
                </pre>
              </div>
            </div>
          )}

          {/* Standard Error */}
          {stderr && (
            <div className="mb-3">
              <div className="text-xs text-red-400 mb-1">STDERR:</div>
              <div className="bg-gray-800 px-3 py-2 rounded max-h-60 overflow-auto dark:bg-gray-900 border-l-2 border-red-500">
                <pre className="text-sm text-red-300 whitespace-pre-wrap break-words dark:text-red-400">
                  {stderr}
                </pre>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div>
              <div className="text-xs text-red-400 mb-1">ERROR:</div>
              <div className="bg-gray-800 px-3 py-2 rounded dark:bg-gray-900 border-l-2 border-red-500">
                <pre className="text-sm text-red-300 whitespace-pre-wrap break-words dark:text-red-400">
                  {error}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
