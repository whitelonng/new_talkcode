import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserHighlightElementTool = createTool({
  name: 'browserHighlightElement',
  description: 'Highlight an element in the controllable built-in browser using a CSS selector.',
  inputSchema: z.object({
    selector: z.string().min(1).describe('CSS selector for the target element.'),
    durationMs: z
      .number()
      .int()
      .positive()
      .optional()
      .default(2000)
      .describe('How long to keep the highlight visible.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector, durationMs }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'highlightElement',
      params: { selector, durationMs },
    });

    return {
      success: result.success,
      message: result.success ? `Highlighted element: ${selector}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector }) => (
    <GenericToolDoing type="browser" operation="update" target={selector} details="Highlight element" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
