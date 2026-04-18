import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserClearConsoleTool = createTool({
  name: 'browserClearConsole',
  description: 'Clear cached console entries captured from the controllable built-in browser.',
  inputSchema: z.object({}),
  canConcurrent: false,
  hidden: true,
  execute: async () => {
    const result = await browserBridgeService.executeCommand({
      kind: 'clearConsole',
      params: {},
    });
    browserBridgeService.getState().clearConsoleEntries();

    return {
      success: result.success,
      message: result.success ? 'Cleared browser console entries.' : result.error,
      data: result.data,
    };
  },
  renderToolDoing: () => <GenericToolDoing type="browser" operation="update" target="console" details="Clear console" />,
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
