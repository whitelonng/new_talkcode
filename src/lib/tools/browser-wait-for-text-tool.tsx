import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserWaitForTextTool = createTool({
  name: 'browserWaitForText',
  description: 'Wait until target text appears in the controllable built-in browser page.',
  inputSchema: z.object({
    text: z.string().min(1).describe('Text content to wait for.'),
    timeoutMs: z.number().int().positive().optional().default(10000),
    pollIntervalMs: z.number().int().positive().optional().default(200),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ text, timeoutMs, pollIntervalMs }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'waitForText',
      timeoutMs,
      params: { text, timeoutMs, pollIntervalMs },
    });

    return {
      success: result.success,
      message: result.success ? `Wait text satisfied: ${text}` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ text }) => (
    <GenericToolDoing type="browser" operation="read" target={text} details="Wait for text" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
