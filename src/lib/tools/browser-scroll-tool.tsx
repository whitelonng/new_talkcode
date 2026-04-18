import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserScrollTool = createTool({
  name: 'browserScroll',
  description: 'Scroll the controllable built-in browser viewport or a target element.',
  inputSchema: z.object({
    x: z.number().optional().default(0).describe('Horizontal scroll delta or target x position.'),
    y: z.number().optional().default(0).describe('Vertical scroll delta or target y position.'),
    behavior: z.enum(['auto', 'smooth']).optional().default('auto'),
    selector: z.string().optional().describe('Optional CSS selector for an element to scroll.'),
    mode: z.enum(['by', 'to']).optional().default('by').describe('Scroll by delta or to absolute position.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ x, y, behavior, selector, mode }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'scroll',
      params: { x, y, behavior, selector, mode },
    });

    return {
      success: result.success,
      message: result.success
        ? selector
          ? `Scrolled element: ${selector}`
          : `Scrolled browser viewport (${mode}).`
        : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ selector, x, y }) => (
    <GenericToolDoing
      type="browser"
      operation="update"
      target={selector || 'window'}
      details={`scroll x=${x}, y=${y}`}
    />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
