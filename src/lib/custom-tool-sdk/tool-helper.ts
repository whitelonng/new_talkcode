import type { CustomToolDefinition } from '@/types/custom-tool';
import type { ToolInput, ToolOutput } from '@/types/tool';

export function toolHelper<TInput extends ToolInput, TOutput extends ToolOutput>(
  definition: CustomToolDefinition<TInput, TOutput>
) {
  return definition;
}
