// docs/components/share/share-markdown.tsx
// Web-compatible markdown renderer for shared conversations

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { ShareCodeBlock } from './share-code-block';

export interface ShareMarkdownProps {
  content: string;
}

function ShareMarkdownComponent({ content }: ShareMarkdownProps) {
  const handleLinkClick = (e: React.MouseEvent, href?: string) => {
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="share-markdown prose prose-sm prose-invert max-w-none">
      <ReactMarkdown
        components={{
          a: ({ node, href, children, ...props }) => (
            <a
              href={href}
              onClick={(e) => handleLinkClick(e, href)}
              className="text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          p: ({ node, ...props }) => <p dir="auto" {...props} />,
          li: ({ node, ...props }) => <li dir="auto" {...props} />,
          pre: ({ node, children, ...props }) => (
            <ShareCodeBlock {...props}>{children}</ShareCodeBlock>
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table
                className="min-w-full border-collapse border border-gray-600"
                {...props}
              />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th
              className="border border-gray-600 bg-gray-800 px-4 py-2 text-left font-medium text-gray-100"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td
              className="border border-gray-600 px-4 py-2 text-gray-200"
              {...props}
            />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-gray-600 pl-4 italic text-gray-300"
              {...props}
            />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-gray-600" {...props} />
          ),
        }}
        rehypePlugins={[
          [rehypeHighlight as never, { detect: false, ignoreMissing: true }],
        ]}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const ShareMarkdown = memo(ShareMarkdownComponent);
