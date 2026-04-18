import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserWaitForElementStateTool = createTool({
  name: 'browserWaitForElementState',
  description: 'Wait until an element reaches a target state in the controllable built-in browser.',
  inputSchema: z.object({
    selector: z.string().min(1).describe('CSS selector for the target element.'),
    state: z.enum(['attached', 'visible', 'hidden', 'enabled', 'disabled']).describe('Expected element state.'),
    timeoutMs: z.number().int().positive().optional().default(10000),
    pollIntervalMs: z.number().int().positive().optional().default(200),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector, state, timeoutMs, pollIntervalMs }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'waitForElementState',
      timeoutMs,
      params: { selector, state, timeoutMs, pollIntervalMs },
    });

    return {
      success: result.success,
      message: result.success ? `Element state satisfied: ${selector} -> ${state}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector, state }) => (
    <GenericToolDoing type="browser" operation="read" target={selector} details={`Wait for ${state}`} />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
