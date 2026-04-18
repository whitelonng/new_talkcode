import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';

export const browserControlTool = createTool({
  name: 'browserControl',
  description:
    'Enable the built-in browser control tool group for navigation, snapshot, clicking, typing, script execution, waiting, scrolling, console reading, and highlighting.',
  inputSchema: z.object({}),
  canConcurrent: true,
  execute: async () => ({
    success: true,
    message: 'Browser Control is a grouped tool toggle. Enable it from the tool selector to grant all built-in browser control sub-tools.',
  }),
  renderToolDoing: () => <GenericToolDoing type="browser" operation="custom" target="Browser Control" />,
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
