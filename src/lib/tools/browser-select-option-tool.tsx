import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserSelectOptionTool = createTool({
  name: 'browserSelectOption',
  description: 'Select an option in a select element within the controllable built-in browser.',
  inputSchema: z.object({
    selector: z.string().min(1).describe('CSS selector for the target select element.'),
    value: z.string().optional().describe('Option value to select.'),
    label: z.string().optional().describe('Option label text to select.'),
    index: z.number().int().nonnegative().optional().describe('Option index to select.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector, value, label, index }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'selectOption',
      params: { selector, value, label, index },
    });

    return {
      success: result.success,
      message: result.success ? `Selected option in: ${selector}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector }) => (
    <GenericToolDoing type="browser" operation="update" target={selector} details="Select option" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
