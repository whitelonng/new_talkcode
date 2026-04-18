import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserSnapshotTool = createTool({
  name: 'browserSnapshot',
  description:
    'Read a structured snapshot from the controllable built-in browser, including title, URL, selected text content, and recent console logs.',
  inputSchema: z.object({
    selector: z
      .string()
      .optional()
      .describe('Optional CSS selector to scope text extraction. Defaults to document.body.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ selector }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'snapshot',
      params: { selector },
    });

    return {
      success: result.success,
      message: result.success ? 'Captured built-in browser snapshot.' : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector }) => (
    <GenericToolDoing
      type="browser"
      operation="read"
      target={selector || 'document.body'}
      details="Snapshot"
    />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
