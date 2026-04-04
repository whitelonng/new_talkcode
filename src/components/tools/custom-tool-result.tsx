import { CustomToolResultFallback } from '@/services/tools/custom-tool-ui-fallback';
import type { CustomToolDefinition } from '@/types/custom-tool';

interface CustomToolResultProps {
  definition: CustomToolDefinition;
  input: Record<string, unknown>;
  output: unknown;
}

export function CustomToolResult({ definition, input, output }: CustomToolResultProps) {
  const render =
    definition.renderToolResult ??
    ((result: unknown) => {
      if (result && typeof result === 'object') {
        const outputObj = result as { success?: boolean; error?: string };
        if (outputObj.success === false || outputObj.error) {
          return (
            <CustomToolResultFallback
              success={outputObj.success ?? false}
              error={outputObj.error || 'Custom tool failed'}
            />
          );
        }
      }

      const message = typeof result === 'string' ? result : 'Custom tool executed';
      return <CustomToolResultFallback message={message} success={true} />;
    });

  return render(output, input, { toolName: definition.name });
}
