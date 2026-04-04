// docs/components/share/tools/share-read-file-result.tsx
// ReadFile tool result renderer for share page

import { File } from 'lucide-react';
import type { ReadFileOutput } from '@/types/share-tools';
import { ShareMarkdown } from '../share-markdown';

interface ShareReadFileResultProps {
  output: ReadFileOutput;
}

export function ShareReadFileResult({ output }: ShareReadFileResultProps) {
  const { file_path, content } = output;
  const fileName = file_path.split('/').pop() || file_path;
  const lineCount = content.split('\n').length;

  // Detect language from file extension
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'tsx',
      js: 'javascript',
      jsx: 'jsx',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      css: 'css',
      scss: 'scss',
      html: 'html',
      json: 'json',
      md: 'markdown',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      sh: 'bash',
      sql: 'sql',
    };
    return languageMap[ext || ''] || '';
  };

  const language = getLanguage(file_path);
  
  // Format content as code block for markdown rendering
  const markdownContent = `\`\`\`${language}
${content}
\`\`\``;

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
        <File className="h-4 w-4 text-blue-500" />
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{fileName}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{lineCount} lines</span>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-auto p-4">
        <ShareMarkdown content={markdownContent} />
      </div>
    </div>
  );
}
