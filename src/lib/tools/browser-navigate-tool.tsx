import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserNavigateTool = createTool({
  name: 'browserNavigate',
  description:
    'Open or navigate the built-in browser to a URL and make the browser panel visible for further interaction.',
  inputSchema: z.object({
    url: z.string().min(1).describe('The URL to open in the built-in browser.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ url }) => {
    browserBridgeService.openUrl(url);
    return {
      success: true,
      url,
      message: `Opened built-in browser: ${url}`,
    };
  },
  renderToolDoing: ({ url }) => (
    <GenericToolDoing type="browser" operation="navigate" target={url} details="URL" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} />
  ),
});
