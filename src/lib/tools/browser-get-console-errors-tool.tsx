import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserGetConsoleErrorsTool = createTool({
  name: 'browserGetConsoleErrors',
  description: 'Read recent console error entries captured from the controllable built-in browser.',
  inputSchema: z.object({
    limit: z.number().int().positive().optional().default(50).describe('Maximum number of recent console error entries to return.'),
  }),
  canConcurrent: true,
  hidden: true,
  execute: async ({ limit }) => {
    const entries = browserBridgeService.getConsoleEntries({ limit, level: 'error' });
    return {
      success: true,
      message: `Retrieved ${entries.length} console error entr${entries.length === 1 ? 'y' : 'ies'}.`,
      data: entries,
    };
  },
  renderToolDoing: () => (
    <GenericToolDoing type="browser" operation="read" target="console errors" details="Get console errors" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
