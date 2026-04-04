import {
  Bot,
  CheckSquare,
  File,
  FileEdit,
  FileText,
  Folder,
  Globe,
  List,
  Search,
  Terminal,
} from 'lucide-react';

interface GenericToolDoingProps {
  operation: string;
  filePath?: string;
  target?: string;
  type?: string;
  details?: string;
}

export function GenericToolDoing({
  operation,
  filePath,
  target,
  type,
  details,
}: GenericToolDoingProps) {
  const iconClass = 'h-5 w-5 text-gray-600 dark:text-gray-400';

  const getIcon = () => {
    switch (operation) {
      case 'read':
        return <FileText className={iconClass} />;
      case 'write':
        return <File className={iconClass} />;
      case 'edit':
        return <FileEdit className={iconClass} />;
      case 'search':
        return <Search className={iconClass} />;
      case 'execute':
        return <Terminal className={iconClass} />;
      case 'list':
      case 'find':
        return <List className={iconClass} />;
      case 'call':
        return <Bot className={iconClass} />;
      case 'crawl':
        return <Globe className={iconClass} />;
      case 'fetch':
        return <Globe className={iconClass} />;
      case 'update':
        return <CheckSquare className={iconClass} />;
      default:
        return <File className={iconClass} />;
    }
  };

  const getOperationText = () => {
    switch (operation) {
      case 'read':
        return type ? `Reading ${type}` : 'Reading file';
      case 'write':
        return 'Writing file';
      case 'edit':
        return 'Editing file';
      case 'search':
        return 'Searching';
      case 'execute':
        return 'Executing';
      case 'list':
        return 'Listing files';
      case 'find':
        return 'Finding files';
      case 'call':
        return 'Calling agent';
      case 'crawl':
        return 'Crawling web';
      case 'fetch':
        return 'Fetching web page';
      case 'update':
        return 'Updating';
      case 'custom':
        return 'Running custom tool';
      default:
        return `Processing ${operation}`;
    }
  };

  const displayTarget = target || filePath;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg w-full">
      <div className="flex items-center gap-2">
        <div className="relative">
          {getIcon()}
          <div className="absolute -top-1 -right-1 h-2 w-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-ping" />
        </div>
        {filePath && <Folder className="h-4 w-4 text-gray-500 dark:text-gray-400 opacity-60" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-gray-700 dark:text-gray-200 text-sm font-medium">
          {getOperationText()}
        </div>
        {displayTarget && (
          <div className="text-gray-600 dark:text-gray-300 text-sm mt-1 font-mono break-words">
            {displayTarget}
          </div>
        )}
        {details && (
          <div className="text-gray-500 dark:text-gray-400 text-sm m-1 break-words">{details}</div>
        )}
      </div>
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
        <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
        <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
