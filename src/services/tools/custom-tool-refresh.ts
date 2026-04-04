import { logger } from '@/lib/logger';
import type { ToolWithUI } from '@/types/tool';
import type { CustomToolLoadOptions } from './custom-tool-loader';
import { loadCustomToolsForRegistry } from './custom-tool-service';

export async function refreshCustomTools(
  options: CustomToolLoadOptions
): Promise<Record<string, ToolWithUI>> {
  const state = await loadCustomToolsForRegistry(options);
  const tools: Record<string, ToolWithUI> = {};

  for (const tool of state.tools) {
    tools[tool.name] = tool;
  }

  if (state.errors.length > 0) {
    logger.warn('[CustomToolRefresh] Some custom tools failed to reload', state.errors);
  }

  return tools;
}
