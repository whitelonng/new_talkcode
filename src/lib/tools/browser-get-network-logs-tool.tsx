import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserGetNetworkLogsTool = createTool({
  name: 'browserGetNetworkLogs',
  description: 'Read recent fetch/xhr network entries captured from the controllable built-in browser.',
  inputSchema: z.object({
    limit: z.number().int().positive().max(200).optional().default(50),
    type: z.enum(['fetch', 'xhr']).optional(),
    success: z.boolean().optional(),
  }),
  canConcurrent: true,
  hidden: true,
  execute: async ({ limit, type, success }) => {
    const entries = browserBridgeService.getNetworkEntries({ limit, type, success });
    return {
      success: true,
      message: `Retrieved ${entries.length} network entr${entries.length === 1 ? 'y' : 'ies'}.`,
      data: entries,
    };
  },
  renderToolDoing: ({ type }) => (
    <GenericToolDoing type="browser" operation="read" target={type || 'network'} details="Get network logs" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
