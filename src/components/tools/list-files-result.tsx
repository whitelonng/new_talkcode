interface ListFilesResultProps {
  result: string;
}

export function ListFilesResult({ result }: ListFilesResultProps) {
  return (
    <div className="space-y-3">
      {/* Show file listing if available */}
      {result && (
        <div className="border rounded-lg p-3 bg-white dark:bg-gray-900 dark:border-gray-700">
          <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-48 bg-gray-50 p-2 rounded dark:bg-gray-800 dark:text-gray-300">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
