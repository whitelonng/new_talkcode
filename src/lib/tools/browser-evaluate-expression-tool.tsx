import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

export const browserEvaluateExpressionTool = createTool({
  name: 'browserEvaluateExpression',
  description: 'Evaluate a JavaScript expression in the controllable built-in browser and return the serialized result.',
  inputSchema: z.object({
    expression: z.string().min(1).describe('JavaScript expression to evaluate in the page context.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ expression }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'evaluateExpression',
      params: {
        expression,
      },
    });

    return {
      success: result.success,
      message: result.success ? 'Evaluated browser expression.' : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ expression }) => (
    <GenericToolDoing type="browser" operation="read" target={expression} details="Evaluate expression" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
