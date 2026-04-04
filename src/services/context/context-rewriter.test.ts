import type { ContentPart, Message as ModelMessage } from '@/services/llm/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextRewriter } from './context-rewriter';

// Use vi.hoisted to create mock functions that can be referenced in vi.mock
const mockSummarizeCodeContent = vi.hoisted(() => vi.fn());

// Mock code-navigation-service
vi.mock('@/services/code-navigation-service', () => ({
  summarizeCodeContent: mockSummarizeCodeContent,
  getLangIdFromPath: (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'tsx';
      case 'js':
        return 'javascript';
      case 'py':
        return 'python';
      case 'rs':
        return 'rust';
      case 'go':
        return 'go';
      case 'java':
        return 'java';
      case 'c':
        return 'c';
      case 'cpp':
        return 'cpp';
      default:
        return null;
    }
  },
}));

// Helper to generate content with a specific number of lines
function generateContent(lineCount: number): string {
  return Array.from({ length: lineCount }, (_, i) => `line ${i + 1}`).join('\n');
}

// Helper to create a readFile tool-result message
// Uses type: 'text' with JSON.stringify to match llm-service.ts behavior
function createReadFileResult(
  toolCallId: string,
  filePath: string,
  content: string,
  success = true
): ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId,
        toolName: 'readFile',
        output: {
          type: 'text',
          value: JSON.stringify(
            {
              success,
              file_path: filePath,
              content,
              message: `Read ${filePath}`,
            },
            null,
            2
          ),
        },
      },
    ],
  };
}

// Helper to create a writeFile tool-call message
function createWriteFileCall(
  toolCallId: string,
  filePath: string,
  content: string
): ModelMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId,
        toolName: 'writeFile',
        input: {
          file_path: filePath,
          content,
        },
      },
    ],
  };
}

describe('MessageRewriter', () => {
  let messageRewriter: ContextRewriter;

  beforeEach(() => {
    vi.clearAllMocks();
    messageRewriter = new ContextRewriter();
  });

  describe('rewriteMessages', () => {
    it('should return empty array for empty input', async () => {
      const result = await messageRewriter.rewriteMessages([]);
      expect(result).toEqual([]);
    });

    it('should return messages unchanged when no readFile or writeFile tools', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      const result = await messageRewriter.rewriteMessages(messages);
      expect(result).toEqual(messages);
    });

    it('should not process non-tool messages', async () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const result = await messageRewriter.rewriteMessages(messages);
      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });
  });

  describe('processReadFileResult', () => {
    it('should not summarize files under LINE_THRESHOLD (100 lines)', async () => {
      const smallContent = generateContent(50);
      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/src/small.ts', smallContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should not summarize files with exactly LINE_THRESHOLD lines', async () => {
      const boundaryContent = generateContent(100);
      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/src/boundary.ts', boundaryContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should summarize TypeScript files over LINE_THRESHOLD', async () => {
      const largeContent = generateContent(150);
      const summarizedContent = '// Summarized: function signatures...';

      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: true,
        summary: summarizedContent,
        original_lines: 150,
        lang_id: 'typescript',
      });

      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/src/large.ts', largeContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(mockSummarizeCodeContent).toHaveBeenCalledWith(
        largeContent,
        'typescript',
        '/src/large.ts'
      );

      // Verify the content was replaced
      const toolResult = result[0] as ModelMessage & { role: 'tool' };
      const part = toolResult.content[0] as ContentPart;
      if (part.type !== 'tool-result') {
        throw new Error('Expected tool-result content part');
      }
      const output = part.output as { type: 'text'; value: string };
      const parsedOutput = JSON.parse(output.value);
      expect(parsedOutput.content).toBe(summarizedContent);
      expect(parsedOutput.message).toContain('[COMPRESSED: 150 lines → summarized]');
    });

    it('should summarize Python files over LINE_THRESHOLD', async () => {
      const largeContent = generateContent(200);
      const summarizedContent = '# Python summary...';

      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: true,
        summary: summarizedContent,
        original_lines: 200,
        lang_id: 'python',
      });

      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/src/large.py', largeContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(mockSummarizeCodeContent).toHaveBeenCalledWith(
        largeContent,
        'python',
        '/src/large.py'
      );

      const toolResult = result[0] as ModelMessage & { role: 'tool' };
      const part = toolResult.content[0] as ContentPart;
      if (part.type !== 'tool-result') {
        throw new Error('Expected tool-result content part');
      }
      const output = part.output as { type: 'text'; value: string };
      const parsed = JSON.parse(output.value);
      expect(parsed.content).toBe(summarizedContent);
    });

    it('should not summarize unsupported file types (md)', async () => {
      const largeContent = generateContent(150);
      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/docs/README.md', largeContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should not summarize unsupported file types (json)', async () => {
      const largeContent = generateContent(150);
      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/config/settings.json', largeContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should keep original content if summarization fails', async () => {
      const largeContent = generateContent(150);

      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: false,
        summary: largeContent,
        original_lines: 150,
        lang_id: 'typescript',
      });

      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/src/large.ts', largeContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
    });

    it('should handle readFile results with success=false', async () => {
      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/src/nonexistent.ts', '', false),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should handle readFile results with missing file_path', async () => {
      const messages: ModelMessage[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'readFile',
              output: {
                type: 'text',
                value: JSON.stringify({
                  success: true,
                  content: generateContent(150),
                  message: 'Read file',
                  // Missing file_path
                }),
              },
            },
          ],
        },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should handle summarizeCodeContent throwing error', async () => {
      const largeContent = generateContent(150);

      mockSummarizeCodeContent.mockRejectedValueOnce(new Error('Tauri error'));

      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/src/large.ts', largeContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      // Should keep original content on error
      expect(result).toEqual(messages);
    });

    it('should process multiple readFile results in same message', async () => {
      const largeContent1 = generateContent(150);
      const largeContent2 = generateContent(200);
      const smallContent = generateContent(50);

      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: true,
        summary: '// Summary 1',
        original_lines: 150,
        lang_id: 'typescript',
      });
      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: true,
        summary: '// Summary 2',
        original_lines: 200,
        lang_id: 'typescript',
      });

      const messages: ModelMessage[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'readFile',
              output: {
                type: 'text',
                value: JSON.stringify({
                  success: true,
                  file_path: '/src/large1.ts',
                  content: largeContent1,
                  message: 'Read file',
                }),
              },
            },
            {
              type: 'tool-result',
              toolCallId: 'call-2',
              toolName: 'readFile',
              output: {
                type: 'text',
                value: JSON.stringify({
                  success: true,
                  file_path: '/src/large2.ts',
                  content: largeContent2,
                  message: 'Read file',
                }),
              },
            },
            {
              type: 'tool-result',
              toolCallId: 'call-3',
              toolName: 'readFile',
              output: {
                type: 'text',
                value: JSON.stringify({
                  success: true,
                  file_path: '/src/small.ts',
                  content: smallContent,
                  message: 'Read file',
                }),
              },
            },
          ],
        },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(mockSummarizeCodeContent).toHaveBeenCalledTimes(2);

      const toolMessage = result[0] as ModelMessage & { role: 'tool' };
      const parts = toolMessage.content as ContentPart[];

      // First two should be summarized
      const part1 = parts[0];
      if (part1?.type !== 'tool-result') {
        throw new Error('Expected tool-result content part');
      }
      const output1 = part1.output as { type: 'text'; value: string };
      const parsed1 = JSON.parse(output1.value);
      expect(parsed1.content).toBe('// Summary 1');

      const part2 = parts[1];
      if (part2?.type !== 'tool-result') {
        throw new Error('Expected tool-result content part');
      }
      const output2 = part2.output as { type: 'text'; value: string };
      const parsed2 = JSON.parse(output2.value);
      expect(parsed2.content).toBe('// Summary 2');

      // Third should be unchanged (small file)
      const part3 = parts[2];
      if (part3?.type !== 'tool-result') {
        throw new Error('Expected tool-result content part');
      }
      const output3 = part3.output as { type: 'text'; value: string };
      const parsed3 = JSON.parse(output3.value);
      expect(parsed3.content).toBe(smallContent);
    });
  });

  describe('processWriteFileCall', () => {
    it('should not summarize writeFile calls under LINE_THRESHOLD', async () => {
      const smallContent = generateContent(50);
      const messages: ModelMessage[] = [createWriteFileCall('call-1', '/src/small.ts', smallContent)];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should summarize writeFile calls over LINE_THRESHOLD', async () => {
      const largeContent = generateContent(150);
      const summarizedContent = '// Summarized writeFile content';

      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: true,
        summary: summarizedContent,
        original_lines: 150,
        lang_id: 'typescript',
      });

      const messages: ModelMessage[] = [createWriteFileCall('call-1', '/src/large.ts', largeContent)];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(mockSummarizeCodeContent).toHaveBeenCalledWith(
        largeContent,
        'typescript',
        '/src/large.ts'
      );

      const assistantMsg = result[0] as ModelMessage & { role: 'assistant' };
      const part = assistantMsg.content[0] as ContentPart;
      if (part.type !== 'tool-call') {
        throw new Error('Expected tool-call content part');
      }
      const input = part.input as { file_path: string; content: string };
      expect(input.content).toBe(summarizedContent);
    });

    it('should not summarize unsupported file types in writeFile', async () => {
      const largeContent = generateContent(150);
      const messages: ModelMessage[] = [
        createWriteFileCall('call-1', '/docs/README.md', largeContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should handle writeFile calls with missing file_path', async () => {
      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'writeFile',
              input: {
                content: generateContent(150),
                // Missing file_path
              },
            },
          ],
        },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should handle writeFile calls with missing content', async () => {
      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'writeFile',
              input: {
                file_path: '/src/file.ts',
                // Missing content
              },
            },
          ],
        },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should keep original content if summarization fails for writeFile', async () => {
      const largeContent = generateContent(150);

      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: false,
        summary: largeContent,
        original_lines: 150,
        lang_id: 'typescript',
      });

      const messages: ModelMessage[] = [createWriteFileCall('call-1', '/src/large.ts', largeContent)];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
    });

    it('should handle summarizeCodeContent throwing error for writeFile', async () => {
      const largeContent = generateContent(150);

      mockSummarizeCodeContent.mockRejectedValueOnce(new Error('Tauri error'));

      const messages: ModelMessage[] = [createWriteFileCall('call-1', '/src/large.ts', largeContent)];

      const result = await messageRewriter.rewriteMessages(messages);

      // Should keep original content on error
      expect(result).toEqual(messages);
    });

    it('should handle writeFile with string input (JSON parse)', async () => {
      const largeContent = generateContent(150);
      const summarizedContent = '// Summarized';

      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: true,
        summary: summarizedContent,
        original_lines: 150,
        lang_id: 'typescript',
      });

      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'writeFile',
              input: JSON.stringify({
                file_path: '/src/large.ts',
                content: largeContent,
              }),
            } as unknown as ContentPart,
          ],
        },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(mockSummarizeCodeContent).toHaveBeenCalled();

      const assistantMsg = result[0] as ModelMessage & { role: 'assistant' };
      const part = assistantMsg.content[0] as ContentPart;
      const input = part.input as { file_path: string; content: string };
      expect(input.content).toBe(summarizedContent);
    });
  });

  describe('mixed message processing', () => {
    it('should process both readFile and writeFile in same conversation', async () => {
      const largeReadContent = generateContent(150);
      const largeWriteContent = generateContent(200);

      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: true,
        summary: '// Read summary',
        original_lines: 150,
        lang_id: 'typescript',
      });
      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: true,
        summary: '// Write summary',
        original_lines: 200,
        lang_id: 'typescript',
      });

      const messages: ModelMessage[] = [
        { role: 'user', content: 'Read and modify the file' },
        createReadFileResult('call-1', '/src/file.ts', largeReadContent),
        createWriteFileCall('call-2', '/src/file.ts', largeWriteContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(mockSummarizeCodeContent).toHaveBeenCalledTimes(2);

      // User message unchanged
      expect(result[0]).toEqual(messages[0]);

      // Read result summarized
      const toolResult = result[1] as ModelMessage & { role: 'tool' };
      const readPart = toolResult.content[0] as ContentPart;
      if (readPart.type !== 'tool-result') {
        throw new Error('Expected tool-result content part');
      }
      const readOutput = readPart.output as { type: 'text'; value: string };
      const parsedReadOutput = JSON.parse(readOutput.value);
      expect(parsedReadOutput.content).toBe('// Read summary');

      // Write call summarized
      const assistantMsg = result[2] as ModelMessage & { role: 'assistant' };
      const writePart = assistantMsg.content[0] as ContentPart;
      if (writePart.type !== 'tool-call') {
        throw new Error('Expected tool-call content part');
      }
      const writeInput = writePart.input as { file_path: string; content: string };
      expect(writeInput.content).toBe('// Write summary');
    });

    it('should handle assistant messages with mixed content (text + tool-call)', async () => {
      const largeContent = generateContent(150);

      mockSummarizeCodeContent.mockResolvedValueOnce({
        success: true,
        summary: '// Summary',
        original_lines: 150,
        lang_id: 'typescript',
      });

      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me write the file for you.' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'writeFile',
              input: {
                file_path: '/src/large.ts',
                content: largeContent,
              },
            },
          ],
        },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(mockSummarizeCodeContent).toHaveBeenCalled();

      const assistantMsg = result[0] as ModelMessage & { role: 'assistant' };
      expect(assistantMsg.content).toHaveLength(2);

      // Text part should be unchanged
      const textPart = assistantMsg.content[0] as { type: 'text'; text: string };
      expect(textPart.text).toBe('Let me write the file for you.');

      // Tool call should be summarized
      const toolCallPart = assistantMsg.content[1] as ContentPart;
      if (toolCallPart.type !== 'tool-call') {
        throw new Error('Expected tool-call content part');
      }
      const input = toolCallPart.input as { file_path: string; content: string };
      expect(input.content).toBe('// Summary');
    });

    it('should only process readFile and writeFile tools, not other tools', async () => {
      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'bash',
              input: { command: generateContent(150) },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'bash',
              output: { type: 'text', value: generateContent(150) },
            },
          ],
        },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });
  });

  describe('language support', () => {
    const supportedExtensions = ['ts', 'tsx', 'js', 'py', 'rs', 'go', 'java', 'c', 'cpp'];

    for (const ext of supportedExtensions) {
      it(`should summarize .${ext} files`, async () => {
        const largeContent = generateContent(150);

        mockSummarizeCodeContent.mockResolvedValueOnce({
          success: true,
          summary: `// ${ext} summary`,
          original_lines: 150,
          lang_id: ext,
        });

        const messages: ModelMessage[] = [
          createReadFileResult('call-1', `/src/file.${ext}`, largeContent),
        ];

        const result = await messageRewriter.rewriteMessages(messages);

        expect(mockSummarizeCodeContent).toHaveBeenCalled();

        const toolResult = result[0] as ModelMessage & { role: 'tool' };
        const part = toolResult.content[0] as ContentPart;
        if (part.type !== 'tool-result') {
          throw new Error('Expected tool-result content part');
        }
        const output = part.output as { type: 'text'; value: string };
        const parsed = JSON.parse(output.value);
        expect(parsed.content).toBe(`// ${ext} summary`);
      });
    }

    const unsupportedExtensions = ['md', 'json', 'yaml', 'yml', 'txt', 'html', 'css', 'scss'];

    for (const ext of unsupportedExtensions) {
      it(`should NOT summarize .${ext} files`, async () => {
        const largeContent = generateContent(150);

        const messages: ModelMessage[] = [
          createReadFileResult('call-1', `/src/file.${ext}`, largeContent),
        ];

        const result = await messageRewriter.rewriteMessages(messages);

        expect(result).toEqual(messages);
        expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
      });
    }
  });

  describe('edge cases', () => {
    it('should handle tool message with non-array content', async () => {
      const messages: ModelMessage[] = [
        {
          role: 'tool',
          content: 'plain string content' as unknown as ContentPart[],
        },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should handle assistant message with non-array content', async () => {
      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: 'Just a text response',
        },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should preserve message order after rewriting', async () => {
      const largeContent = generateContent(150);

      mockSummarizeCodeContent.mockResolvedValue({
        success: true,
        summary: '// Summary',
        original_lines: 150,
        lang_id: 'typescript',
      });

      const messages: ModelMessage[] = [
        { role: 'user', content: 'First' },
        createReadFileResult('call-1', '/src/file1.ts', largeContent),
        { role: 'assistant', content: 'Middle' },
        createReadFileResult('call-2', '/src/file2.ts', largeContent),
        { role: 'user', content: 'Last' },
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result.length).toBe(5);
      expect(result[0]).toEqual({ role: 'user', content: 'First' });
      expect(result[2]).toEqual({ role: 'assistant', content: 'Middle' });
      expect(result[4]).toEqual({ role: 'user', content: 'Last' });
    });

    it('should handle empty content in readFile result', async () => {
      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/src/empty.ts', ''),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });

    it('should handle file path with no extension', async () => {
      const largeContent = generateContent(150);
      const messages: ModelMessage[] = [
        createReadFileResult('call-1', '/src/Makefile', largeContent),
      ];

      const result = await messageRewriter.rewriteMessages(messages);

      expect(result).toEqual(messages);
      expect(mockSummarizeCodeContent).not.toHaveBeenCalled();
    });
  });
});
