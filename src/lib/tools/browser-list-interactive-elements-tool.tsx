import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserListInteractiveElementsTool = createTool({
  name: 'browserListInteractiveElements',
  description: 'List interactive elements discoverable in the controllable built-in browser.',
  inputSchema: z.object({
    limit: z.number().int().positive().max(500).optional().default(200),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ limit }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'listInteractiveElements',
      params: { limit },
    });

    return {
      success: result.success,
      message: result.success ? 'Listed interactive browser elements.' : result.error,
      data: result.data,
    };
  },
  renderToolDoing: () => (
    <GenericToolDoing type="browser" operation="read" target="interactive elements" details="Discover elements" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
