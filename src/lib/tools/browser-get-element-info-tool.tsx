import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserGetElementInfoTool = createTool({
  name: 'browserGetElementInfo',
  description: 'Get detailed information for one element in the controllable built-in browser.',
  inputSchema: z.object({
    selector: z.string().min(1).describe('CSS selector for the target element.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'getElementInfo',
      params: { selector },
    });

    return {
      success: result.success,
      message: result.success ? `Retrieved element info: ${selector}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector }) => (
    <GenericToolDoing type="browser" operation="read" target={selector} details="Get element info" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
