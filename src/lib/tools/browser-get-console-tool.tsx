import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserGetConsoleTool = createTool({
  name: 'browserGetConsole',
  description: 'Read recent console entries captured from the controllable built-in browser.',
  inputSchema: z.object({
    limit: z.number().int().positive().optional().default(50).describe('Maximum number of recent console entries to return.'),
    level: z
      .enum(['log', 'info', 'warn', 'error'])
      .optional()
      .describe('Optional console level filter.'),
  }),
  canConcurrent: true,
  hidden: true,
  execute: async ({ limit, level }) => {
    const entries = browserBridgeService.getConsoleEntries({ limit, level });
    return {
      success: true,
      message: `Retrieved ${entries.length} console entr${entries.length === 1 ? 'y' : 'ies'}.`,
      data: entries,
    };
  },
  renderToolDoing: ({ level }) => (
    <GenericToolDoing type="browser" operation="read" target={level || 'console'} details="Get console" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
