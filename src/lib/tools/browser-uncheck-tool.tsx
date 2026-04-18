import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserUncheckTool = createTool({
  name: 'browserUncheck',
  description: 'Uncheck a checkbox or radio input in the controllable built-in browser.',
  inputSchema: z.object({
    selector: z.string().min(1).describe('CSS selector for the target input element.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'uncheck',
      params: { selector },
    });

    return {
      success: result.success,
      message: result.success ? `Unchecked element: ${selector}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector }) => (
    <GenericToolDoing type="browser" operation="update" target={selector} details="Uncheck element" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
