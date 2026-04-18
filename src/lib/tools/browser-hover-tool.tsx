import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserHoverTool = createTool({
  name: 'browserHover',
  description: 'Hover an element in the controllable built-in browser using a CSS selector.',
  inputSchema: z.object({
    selector: z.string().min(1).describe('CSS selector for the target element.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'hover',
      params: { selector },
    });

    return {
      success: result.success,
      message: result.success ? `Hovered element: ${selector}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector }) => (
    <GenericToolDoing type="browser" operation="update" target={selector} details="Hover element" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
