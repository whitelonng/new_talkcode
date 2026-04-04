import { CustomToolDoingFallback } from '@/services/tools/custom-tool-ui-fallback';
import type { CustomToolDefinition } from '@/types/custom-tool';

interface CustomToolDoingProps {
  definition: CustomToolDefinition;
  input: Record<string, unknown>;
}

export function CustomToolDoing({ definition, input }: CustomToolDoingProps) {
  const render =
    definition.renderToolDoing ?? (() => <CustomToolDoingFallback toolName={definition.name} />);
  return render(input, { toolName: definition.name });
}
