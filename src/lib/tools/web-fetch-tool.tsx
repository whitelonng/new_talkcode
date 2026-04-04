import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { fetchWebContent } from '../utils/web-fetcher';

export const webFetchTool = createTool({
  name: 'webFetch',
  description: 'Fetch and extract content from a web url',
  inputSchema: z.object({
    url: z.string().describe('The URL of the web page to fetch'),
  }),
  canConcurrent: true,
  execute: async ({ url }, context) => {
    return await fetchWebContent(url, context);
  },
  renderToolDoing: ({ url }) => (
    <GenericToolDoing operation="fetch" target={url} details="Fetching web content" />
  ),
  renderToolResult: (result) => {
    const success = !!(result.content || result.title);
    return <GenericToolResult success={success} message={result.content || undefined} />;
  },
});
