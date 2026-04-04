import { ExternalLink, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUiNavigation } from '@/contexts/ui-navigation';
import { NavigationView } from '@/types/navigation';

interface SearchResult {
  title?: string;
  url?: string;
  content?: string;
  search_result?: string;
  user_message?: string;
}

interface SearchToolResultProps {
  results: SearchResult[] | SearchResult;
  query: string;
}

export function SearchToolResult({ results }: SearchToolResultProps) {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { setActiveView } = useUiNavigation();

  // Normalize results to array
  const resultsArray = Array.isArray(results) ? results : [results];

  // Check if there's a user_message indicating missing API key
  const userMessage = resultsArray.find((r) => r.user_message)?.user_message;

  // Auto-open alert dialog when user_message is present
  useEffect(() => {
    if (userMessage) {
      setIsAlertOpen(true);
    }
  }, [userMessage]);

  const handleGoToSettings = () => {
    setIsAlertOpen(false);
    setActiveView(NavigationView.SETTINGS);
  };

  // Filter out results that only have user_message
  const validResults = resultsArray.filter((r) => r.title || r.url || r.content || r.search_result);
  const hasResults = validResults && validResults.length > 0;

  if (!hasResults) {
    return (
      <>
        {userMessage && (
          <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tavily API Key Required</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>To use the web search feature, you need to configure your Tavily API key.</p>
                  <p className="text-sm">
                    Please go to Settings &gt; API Keys to add your Tavily API key.
                  </p>
                  <p className="text-sm">
                    You can get your API key from{' '}
                    <a
                      href="https://docs.tavily.com/documentation/quickstart"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 underline"
                    >
                      Tavily Documentation
                    </a>
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleGoToSettings}>Go to Settings</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-lg p-3 bg-white dark:bg-gray-900 dark:border-gray-700 w-full">
        <div className="flex items-center gap-2 text-gray-700 border-b pb-2 dark:text-gray-300 dark:border-gray-600">
          <Globe className="h-4 w-4" />
          <span className="text-sm font-medium">Top results</span>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {validResults.map((result, index) => (
            <div
              key={`${result.url}-${index}`}
              className="border-l-2 border-blue-200 pl-3 hover:border-blue-400 transition-colors dark:border-blue-800 dark:hover:border-blue-600"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-blue-700 text-sm line-clamp-2 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 break-words">
                    {result.title}
                  </h4>
                  <p className="text-gray-600 text-xs mt-1 line-clamp-2 dark:text-gray-400 break-words">
                    {result.content}
                  </p>
                  {result.url && (
                    <div className="flex items-center gap-1 mt-2 min-w-0">
                      <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0 dark:text-gray-500" />
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 text-xs break-all dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {result.url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
