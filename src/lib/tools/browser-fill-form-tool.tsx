import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { browserBridgeService } from '@/services/browser-bridge-service';

const formFieldSchema = z.object({
  selector: z.string().min(1).describe('CSS selector for the target field.'),
  value: z.string().optional().describe('Text value for input/textarea/contenteditable fields.'),
  checked: z.boolean().optional().describe('Checked state for checkbox/radio fields.'),
  optionValue: z.string().optional().describe('Select option value for select elements.'),
  optionLabel: z.string().optional().describe('Select option label for select elements.'),
  optionIndex: z.number().int().nonnegative().optional().describe('Select option index for select elements.'),
});

export const browserFillFormTool = createTool({
  name: 'browserFillForm',
  description: 'Fill multiple form fields in one call inside the controllable built-in browser.',
  inputSchema: z.object({
    fields: z.array(formFieldSchema).min(1).max(100).describe('Form field fill instructions.'),
    submit: z.boolean().optional().default(false).describe('Whether to submit the containing form after filling.'),
  }),
  canConcurrent: false,
  hidden: true,
  execute: async ({ fields, submit }) => {
    const result = await browserBridgeService.executeCommand({
      kind: 'fillForm',
      params: { fields, submit },
    });

    return {
      success: result.success,
      message: result.success ? `Filled ${fields.length} form field(s).` : result.error,
      data: result.data,
    };
  },
  renderToolDoing: ({ fields }) => (
    <GenericToolDoing type="browser" operation="update" target={`fields:${fields.length}`} details="Fill form" />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} error={result?.message} />
  ),
});
