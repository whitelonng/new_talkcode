import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserFindNetworkRequestTool = createTool({
  name: 'browserFindNetworkRequest',
  description: 'Find the latest captured browser network request matching request id, URL, method, status, type, or success.',
  inputSchema: z.object({
    requestId: z.string().optional().describe('Exact request id to match.'),
    urlIncludes: z.string().optional().describe('Substring that should appear in the request URL.'),
    method: z.string().optional().describe('HTTP method to match, such as GET or POST.'),
    status: z.number().int().nonnegative().optional().describe('HTTP status code to match.'),
    type: z.enum(['fetch', 'xhr']).optional().describe('Request transport type to match.'),
    success: z.boolean().optional().describe('Whether to filter by successful or failed requests.'),
  }),
  canConcurrent: true,
  hidden: true,
  execute: async ({ requestId, urlIncludes, method, status, type, success }) => {
    const entry = browserBridgeService.findNetworkRequest({
      requestId,
      urlIncludes,
      method,
      status,
      type,
      success,
    });

    return {
      success: true,
      message: entry ? `Matched network request: ${entry.requestId}` : 'No matching network request found.',
      data: entry,
    };
  },
  renderToolDoing: ({ requestId, urlIncludes, method }) => (
    <GenericToolDoing
      type="browser"
      operation="read"
      target={requestId || urlIncludes || method || 'network request'}
      details="Find network request"
    />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
