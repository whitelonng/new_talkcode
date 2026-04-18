import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserWaitForTool = createTool({
  name: 'browserWaitFor',
  description:
    'Wait until an element appears in the controllable built-in browser or the page reaches readyState complete.',
  inputSchema: z.object({
    selector: z.string().optional().describe('Optional CSS selector to wait for.'),
    timeoutMs: z.number().int().positive().optional().default(10000),
    pollIntervalMs: z.number().int().positive().optional().default(200),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector, timeoutMs, pollIntervalMs }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'waitFor',
      timeoutMs,
      params: { selector, timeoutMs, pollIntervalMs },
    });

    return {
      success: result.success,
      message: result.success
        ? selector
          ? `Wait condition satisfied: ${selector}`
          : 'Page ready state completed.'
        : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector }) => (
    <GenericToolDoing
      type="browser"
      operation="read"
      target={selector || 'document.readyState'}
      details="Wait for condition"
    />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
