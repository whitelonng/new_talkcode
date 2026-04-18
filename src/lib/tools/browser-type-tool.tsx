import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserTypeTool = createTool({
  name: 'browserType',
  description: 'Type text into an input, textarea, or contenteditable element in the controllable built-in browser.',
  inputSchema: z.object({
    selector: z.string().min(1).describe('CSS selector for the target element.'),
    text: z.string().describe('Text to input into the target element.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector, text }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'type',
      params: { selector, text },
    });

    return {
      success: result.success,
      message: result.success ? `Typed into element: ${selector}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector, text }) => (
    <GenericToolDoing type="browser" operation="type" target={selector} details={text} />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
