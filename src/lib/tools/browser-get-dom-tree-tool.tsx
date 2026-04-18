import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserGetDomTreeTool = createTool({
  name: 'browserGetDomTree',
  description: 'Read a trimmed DOM tree from the controllable built-in browser.',
  inputSchema: z.object({
    selector: z.string().optional().describe('Optional root selector. Defaults to document.body.'),
    maxDepth: z.number().int().positive().max(8).optional().default(4),
    maxChildren: z.number().int().positive().max(100).optional().default(20),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector, maxDepth, maxChildren }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'getDomTree',
      params: { selector, maxDepth, maxChildren },
    });

    return {
      success: result.success,
      message: result.success ? 'Retrieved browser DOM tree.' : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector }) => (
    <GenericToolDoing type="browser" operation="read" target={selector || 'document.body'} details="Get DOM tree" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
