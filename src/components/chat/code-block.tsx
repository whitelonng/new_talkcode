import { Check, CopyIcon } from 'lucide-react';
import React, { memo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ className, children, ...props }) => {
  const ref = useRef<HTMLPreElement>(null);
  const [hasCopied, setHasCopied] = React.useState(false);

  useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => {
        setHasCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCopied]);

  const handleCopyValue = () => {
    if (ref.current) {
      navigator.clipboard.writeText(ref.current.innerText);
      setHasCopied(true);
    }
  };

  return (
    <div className="group relative max-w-full">
      <pre
        className={`relative p-0 overflow-x-auto max-w-full ${className ?? ''}`}
        ref={ref}
        {...props}
      >
        {children}
      </pre>
      <Button
        className="absolute top-4 right-4 z-10 size-[30px] cursor-pointer border border-white/25 p-1.5 text-primary-foreground hover:bg-transparent dark:text-foreground"
        onClick={() => handleCopyValue()}
        size="sm"
        variant="ghost"
      >
        <span className="sr-only">{hasCopied ? 'Copied' : 'Copy'}</span>
        {hasCopied ? (
          <Check className="size-4 text-green-500" />
        ) : (
          <CopyIcon className="size-4 text-white hover:text-primary" />
        )}
      </Button>
    </div>
  );
};

const MemoizedCodeBlock = memo(CodeBlock);

export default MemoizedCodeBlock;
