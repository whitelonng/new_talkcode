// packages/shared/src/utils/format-tool-summary.ts
// Shared utility for formatting tool input summaries
// Used by both desktop app and share/web to display tool parameters

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface FormatToolInputSummaryOptions {
  output?: unknown;
  sanitize?: boolean; // Whether to sanitize paths for privacy
}

/**
 * Sanitize file path to remove sensitive information
 * Handles various path formats across platforms
 */
function sanitizePath(path: string): string {
  // Handle macOS user paths (/Users/username/...)
  if (path.match(/^\/Users\/[^/]+/)) {
    return path.replace(/^\/Users\/[^/]+/, '~');
  }

  // Handle Windows local paths (C:\Users\username\...)
  if (path.match(/^[A-Z]:\\Users\\/i)) {
    return path.replace(/^[A-Z]:\\Users\\[^\\]+/i, '~').replace(/\\/g, '/');
  }

  // Handle Windows network paths (\\server\share\...)
  if (path.match(/^\\\\[^\\]+\\/)) {
    const parts = path.split('\\').filter(Boolean);
    if (parts.length > 0) {
      return `[network]/${parts.slice(2).join('/')}`;
    }
  }

  // Handle Linux/Unix user paths (/home/username/...)
  if (path.match(/^\/home\/[^/]+/)) {
    return path.replace(/^\/home\/[^/]+/, '~');
  }

  // Handle mounted volumes with usernames (/Volumes/username/... or /mnt/username/...)
  if (path.match(/\/(Volumes|mnt)\/[^/]*[Uu]sers?[^/]*\//)) {
    return path.replace(/\/(Volumes|mnt)\/[^/]+/, '[volume]');
  }

  // Handle WSL paths (/mnt/c/Users/username/...)
  if (path.match(/^\/mnt\/[a-z]\/Users\//i)) {
    return path.replace(/^\/mnt\/[a-z]\/Users\/[^/]+/i, '~');
  }

  return path;
}

/**
 * Format tool input for display summary
 * Provides intelligent formatting based on tool type
 */
export function formatToolInputSummary(
  toolName: string,
  input: Record<string, unknown>,
  options?: FormatToolInputSummaryOptions
): string {
  if (!input) return '';
  
  const { output, sanitize = false } = options || {};

  // Helper to process file paths
  const processPath = (path: string): string => {
    return sanitize ? sanitizePath(path) : path;
  };

  // codeSearch: pattern in path
  if (toolName === 'codeSearch') {
    return `${input.pattern} in ${processPath(String(input.path))}`;
  }

  // exitPlanMode: show action
  if (toolName === 'exitPlanMode') {
    return (output as { action?: string })?.action ?? '';
  }

  // listFiles: directory path
  if (toolName === 'listFiles') {
    return processPath(String(input.directory_path));
  }

  // todoWrite: show in-progress todo or count
  if (toolName === 'todoWrite' && Array.isArray(input.todos)) {
    const inProgressTodo = (input.todos as TodoItem[]).find(
      (todo) => todo.status === 'in_progress'
    );
    if (inProgressTodo?.content) {
      return `"${inProgressTodo.content}" doing`;
    }
    return `Updating ${input.todos.length} todo(s)`;
  }

  // File tools: readFile, writeFile, editFile
  if (input.file_path && typeof input.file_path === 'string') {
    return processPath(input.file_path);
  }

  // Web search: query
  if (input.query && typeof input.query === 'string') {
    return input.query;
  }

  // Bash command
  if (input.command && typeof input.command === 'string') {
    const command = input.command as string;
    // Remove the leading "cd /path/to/workspace && " prefix for bash tool
    if (toolName === 'bashTool' || toolName === 'bash') {
      const match = command.match(/^cd\s+[^\s]+\s+&&\s+(.+)$/);
      if (match?.[1]) {
        return match[1];
      }
    }
    return command;
  }

  // URL-based tools
  if (input.url && typeof input.url === 'string') {
    return input.url;
  }

  // callAgent: agent ID
  if (input.agentId && typeof input.agentId === 'string') {
    return input.agentId;
  }

  // Fallback: join simple values
  const values = Object.values(input).filter(
    (v) => typeof v === 'string' || typeof v === 'number'
  );
  
  if (values.length > 0 && values.length <= 2) {
    const stringValues = values.map(String);
    if (sanitize) {
      return stringValues.map((v) => {
        // Check if it looks like a path
        if (v.includes('/') || v.match(/^[A-Z]:\\/)) {
          return sanitizePath(v);
        }
        return v;
      }).join(' ');
    }
    return stringValues.join(' ');
  }

  // Final fallback: JSON stringify
  try {
    const jsonStr = JSON.stringify(input);
    if (sanitize) {
      // Sanitize any paths in the JSON
      return jsonStr.replace(
        /(["\\/])(?:Users|home|mnt)\/[^"\/]+/g,
        '$1~'
      );
    }
    return jsonStr;
  } catch {
    return 'Complex Input';
  }
}
