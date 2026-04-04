import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';

export function CustomToolDoingFallback({ toolName }: { toolName: string }) {
  return <GenericToolDoing operation="custom" details={`Running ${toolName}`} />;
}

export function CustomToolResultFallback({
  message,
  success,
  error,
}: {
  message?: string;
  success?: boolean;
  error?: string;
}) {
  const resolvedSuccess = success ?? !error;
  return (
    <GenericToolResult
      success={resolvedSuccess}
      message={message ?? (resolvedSuccess ? 'Custom tool executed' : undefined)}
      error={error}
    />
  );
}
