import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserQueryElementsTool = createTool({
  name: 'browserQueryElements',
  description: 'Query multiple DOM elements in the controllable built-in browser using a CSS selector.',
  inputSchema: z.object({
    selector: z.string().min(1).describe('CSS selector used to query elements.'),
    limit: z.number().int().positive().max(200).optional().default(100),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector, limit }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'queryElements',
      params: { selector, limit },
    });

    return {
      success: result.success,
      message: result.success ? `Queried browser elements: ${selector}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector }) => (
    <GenericToolDoing type="browser" operation="read" target={selector} details="Query elements" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
