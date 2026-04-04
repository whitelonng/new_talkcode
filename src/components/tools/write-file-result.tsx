import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface WriteFileResultProps {
  filePath: string;
  content: string;
}

export function WriteFileResult({ filePath, content }: WriteFileResultProps) {
  const fileName = filePath.split('/').pop() || filePath;
  const lineCount = content.split('\n').length;

  return (
    <div className="border rounded-md bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 flex-1">
          <span className="font-medium text-sm">{fileName}</span>
          <span className="text-xs text-muted-foreground">{lineCount} lines</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-auto">
        <SyntaxHighlighter
          language="typescript"
          style={vscDarkPlus}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '12px',
            lineHeight: '1.5',
            background: 'transparent',
          }}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: '#6e7781',
            textAlign: 'right',
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
