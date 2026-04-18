import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';
import { z } from 'zod';

export const browserGetPageStateTool = createTool({
  name: 'browserGetPageState',
  description: 'Get current page state from the controllable built-in browser, including title, URL, readyState, and recent errors.',
  inputSchema: z.object({}),
  canConcurrent: true,
  hidden: true,
  execute: async () => {
    const result = await browserBridgeService.executeCommand({
      kind: 'getPageState',
      params: {},
    });

    return {
      success: result.success,
      message: result.success ? 'Retrieved browser page state.' : result.error,
      data: result.data,
    };
  },
  renderToolDoing: () => <GenericToolDoing type="browser" operation="read" target="page state" details="Get page state" />,
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
