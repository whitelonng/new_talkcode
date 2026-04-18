import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserGetRequestDetailTool = createTool({
  name: 'browserGetRequestDetail',
  description: 'Get full cached detail for one captured browser network request by request id.',
  inputSchema: z.object({
    requestId: z.string().min(1).describe('Captured browser network request id.'),
  }),
  canConcurrent: true,
  hidden: true,
  execute: async ({ requestId }) => {
    const entry = browserBridgeService.getNetworkRequestDetail(requestId);

    return {
      success: true,
      message: entry ? `Retrieved network request detail: ${requestId}` : `Network request not found: ${requestId}`,
      data: entry,
    };
  },
  renderToolDoing: ({ requestId }) => (
    <GenericToolDoing type="browser" operation="read" target={requestId} details="Get request detail" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
