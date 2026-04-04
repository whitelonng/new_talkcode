import { AlertCircle } from 'lucide-react';

interface GenericToolResultProps {
  success: boolean;
  message?: string;
  error?: string;
}

export function GenericToolResult({ success, message, error }: GenericToolResultProps) {
  if (!success) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800 w-full">
        {(error || message) && (
          <div className="flex items-start gap-2 text-red-600 text-sm dark:text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="break-words">{error || message}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800 w-full">
      {message && (
        <div className="text-green-600 text-sm mb-3 dark:text-green-400 break-words">{message}</div>
      )}
    </div>
  );
}
