import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserExecuteScriptTool = createTool({
  name: 'browserExecuteScript',
  description:
    'Execute JavaScript in the controllable built-in browser and return a JSON-serializable result.',
  inputSchema: z.object({
    script: z.string().min(1).describe('JavaScript source code to evaluate in the browser context.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ script }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'executeScript',
      params: { script },
    });

    return {
      success: result.success,
      message: result.success ? 'Executed script in built-in browser.' : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ script }) => (
    <GenericToolDoing type="browser" operation="execute" target="script" details={script} />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
