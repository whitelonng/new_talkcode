import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserWaitForNavigationTool = createTool({
  name: 'browserWaitForNavigation',
  description: 'Wait until the controllable built-in browser navigates to a different URL or a URL matching the expected value.',
  inputSchema: z.object({
    urlIncludes: z.string().optional().describe('Optional URL fragment that the next page URL should include.'),
    timeoutMs: z.number().int().positive().optional().default(10000),
    pollIntervalMs: z.number().int().positive().optional().default(200),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ urlIncludes, timeoutMs, pollIntervalMs }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'waitForNavigation',
      timeoutMs,
      params: { urlIncludes, timeoutMs, pollIntervalMs },
    });

    return {
      success: result.success,
      message: result.success ? 'Browser navigation detected.' : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ urlIncludes }) => (
    <GenericToolDoing
      type="browser"
      operation="read"
      target={urlIncludes || 'navigation'}
      details="Wait for navigation"
    />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
