import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserClickByTextTool = createTool({
  name: 'browserClickByText',
  description: 'Click the first matching clickable element by visible text in the controllable built-in browser.',
  inputSchema: z.object({
    text: z.string().min(1).describe('Target text to match.'),
    exact: z.boolean().optional().default(false).describe('Whether to require exact text match.'),
    caseSensitive: z.boolean().optional().default(false).describe('Whether text matching is case-sensitive.'),
    selector: z
      .string()
      .optional()
      .describe('Optional selector to limit searchable elements. Defaults to common clickable elements.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ text, exact, caseSensitive, selector }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'clickByText',
      params: { text, exact, caseSensitive, selector },
    });

    return {
      success: result.success,
      message: result.success ? `Clicked element by text: ${text}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ text }) => (
    <GenericToolDoing type="browser" operation="click" target={text} details="Click by text" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
