import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserPressKeyTool = createTool({
  name: 'browserPressKey',
  description: 'Dispatch a keyboard key to the active element in the controllable built-in browser.',
  inputSchema: z.object({
    key: z.string().min(1).describe('Keyboard key value, such as Enter, Tab, Escape, or ArrowDown.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ key }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'pressKey',
      params: { key },
    });

    return {
      success: result.success,
      message: result.success ? `Pressed key in browser: ${key}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ key }) => (
    <GenericToolDoing type="browser" operation="type" target={key} details="Press key" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
