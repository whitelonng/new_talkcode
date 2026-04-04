import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, decodeObjectHtmlEntities } from '@/lib/utils';

describe('decodeObjectHtmlEntities necessity demonstration', () => {
  describe('Why we need HTML entity decoding', () => {
    it('should show LLM output may contain HTML entities in strings', () => {
      // Some LLMs (especially when streaming through certain protocols or web interfaces)
      // may encode special characters as HTML entities
      const llmOutput = {
        command: 'echo &quot;Hello World&quot;',
        path: '/path/to/file&lt;test&gt;.txt',
        pattern: 'function\\s+\\w+',
      };

      // Without decoding, these HTML entities would be passed to tools as-is
      expect(llmOutput.command).toBe('echo &quot;Hello World&quot;');
      expect(llmOutput.path).toBe('/path/to/file&lt;test&gt;.txt');

      // With decoding, we get the actual characters
      const decoded = decodeObjectHtmlEntities(llmOutput);
      expect(decoded.command).toBe('echo "Hello World"');
      expect(decoded.path).toBe('/path/to/file<test>.txt');
      expect(decoded.pattern).toBe('function\\s+\\w+'); // unchanged
    });

    it('should handle nested objects with HTML entities', () => {
      const llmOutput = {
        tool: 'bash',
        args: {
          command: 'grep &quot;pattern&quot; file.txt',
          options: {
            case_sensitive: true,
            pattern: 'test&amp;debug',
          },
        },
      };

      const decoded = decodeObjectHtmlEntities(llmOutput);
      expect(decoded.args.command).toBe('grep "pattern" file.txt');
      expect(decoded.args.options.pattern).toBe('test&debug');
    });

    it('should handle arrays with HTML entities', () => {
      const llmOutput = {
        patterns: ['&lt;div&gt;', '&quot;string&quot;', 'normal'],
      };

      const decoded = decodeObjectHtmlEntities(llmOutput);
      expect(decoded.patterns).toEqual(['<div>', '"string"', 'normal']);
    });

    it('should demonstrate real-world scenario: bash command with quotes', () => {
      // LLM wants to execute: echo "Hello & Goodbye"
      // But the streaming protocol encodes it as:
      const encodedToolCall = {
        toolName: 'bash',
        input: {
          command: 'echo &quot;Hello &amp; Goodbye&quot;',
        },
      };

      // Without decoding:
      // The bash command would literally be: echo &quot;Hello &amp; Goodbye&quot;
      // Which would output: &quot;Hello &amp; Goodbye&quot; (not what we want)

      // With decoding:
      const decoded = decodeObjectHtmlEntities(encodedToolCall.input);
      expect(decoded.command).toBe('echo "Hello & Goodbye"');
      // Now the bash command would correctly output: Hello & Goodbye
    });

    it('should demonstrate real-world scenario: file path with special chars', () => {
      // LLM wants to read file: /path/to/<component>.tsx
      // But gets encoded as:
      const encodedToolCall = {
        toolName: 'readFile',
        input: {
          path: '/path/to/&lt;component&gt;.tsx',
        },
      };

      // Without decoding:
      // Would try to read: /path/to/&lt;component&gt;.tsx (doesn't exist)

      // With decoding:
      const decoded = decodeObjectHtmlEntities(encodedToolCall.input);
      expect(decoded.path).toBe('/path/to/<component>.tsx');
      // Now would correctly read: /path/to/<component>.tsx
    });

    it('should demonstrate real-world scenario: regex pattern with special chars', () => {
      // LLM wants to search for: function.*<.*>
      // But gets encoded as:
      const encodedToolCall = {
        toolName: 'codeSearch',
        input: {
          pattern: 'function.*&lt;.*&gt;',
          path: '/project',
        },
      };

      // Without decoding:
      // Would search for literal: function.*&lt;.*&gt; (wrong pattern)

      // With decoding:
      const decoded = decodeObjectHtmlEntities(encodedToolCall.input);
      expect(decoded.pattern).toBe('function.*<.*>');
      // Now would correctly search for generic functions
    });
  });

  describe('When HTML entity decoding is NOT needed', () => {
    it('should not affect normal strings without HTML entities', () => {
      const normalInput = {
        command: 'ls -la',
        path: '/home/user/project',
        numbers: [1, 2, 3],
        boolean: true,
        null: null,
      };

      const decoded = decodeObjectHtmlEntities(normalInput);
      expect(decoded).toEqual(normalInput);
    });

    it('should not affect already decoded strings', () => {
      const alreadyDecoded = {
        command: 'echo "Hello"',
        path: '/path/to/<file>.txt',
      };

      const decoded = decodeObjectHtmlEntities(alreadyDecoded);
      expect(decoded).toEqual(alreadyDecoded);
    });
  });

  describe('Common HTML entities that need decoding', () => {
    it('should decode all common HTML entities', () => {
      const text = '&lt;&gt;&amp;&quot;&#39;&#x27;&#x2F;&#x60;&#x3D;';
      const decoded = decodeHtmlEntities(text);
      expect(decoded).toBe('<>&"\'\'/`=');
    });

    it('should demonstrate why each entity matters', () => {
      const examples = {
        lessThan: '&lt;Component&gt;', // For generic types, JSX
        greaterThan: 'a &gt; b', // For comparisons
        ampersand: 'foo &amp; bar', // For logical operators, URLs
        quote: '&quot;string&quot;', // For string literals
        singleQuote: "&#39;don&#39;t&#39;", // For string literals
        slash: 'path&#x2F;to&#x2F;file', // For file paths
        backtick: '&#x60;template&#x60;', // For template strings
        equals: 'a &#x3D; b', // For assignments
      };

      expect(decodeHtmlEntities(examples.lessThan)).toBe('<Component>');
      expect(decodeHtmlEntities(examples.greaterThan)).toBe('a > b');
      expect(decodeHtmlEntities(examples.ampersand)).toBe('foo & bar');
      expect(decodeHtmlEntities(examples.quote)).toBe('"string"');
      expect(decodeHtmlEntities(examples.singleQuote)).toBe("'don't'");
      expect(decodeHtmlEntities(examples.slash)).toBe('path/to/file');
      expect(decodeHtmlEntities(examples.backtick)).toBe('`template`');
      expect(decodeHtmlEntities(examples.equals)).toBe('a = b');
    });
  });

  describe('Where HTML entities come from', () => {
    it('should explain streaming protocols may encode HTML entities', () => {
      // When LLM outputs are streamed through:
      // 1. HTTP/JSON APIs that sanitize output for web safety
      // 2. Server-Sent Events (SSE) that need to escape special chars
      // 3. WebSocket messages that encode for transport
      // 4. Any middleware that processes the stream for display in HTML

      // Example: Vercel AI SDK streaming through SSE
      // Original: { command: 'echo "hello"' }
      // After SSE encoding: { command: 'echo &quot;hello&quot;' }

      const sseEncodedStream = '{"command":"echo &quot;hello&quot;"}';
      const parsed = JSON.parse(sseEncodedStream);
      expect(parsed.command).toBe('echo &quot;hello&quot;');

      // After decoding:
      const decoded = decodeObjectHtmlEntities(parsed);
      expect(decoded.command).toBe('echo "hello"');
    });
  });
});
