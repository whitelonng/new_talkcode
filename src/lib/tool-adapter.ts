import type { ToolInput, ToolOutput, ToolWithUI } from '@/types/tool';

// Context passed to tool UI renderers
export interface ToolUIContext {
  taskId?: string;
}

// Global registry to store UI renderers for tools
const toolUIRegistry = new Map<
  string,
  {
    renderToolDoing: (params: ToolInput, context?: ToolUIContext) => React.ReactElement | null;
    renderToolResult: (result: ToolOutput, params: ToolInput) => React.ReactElement | null;
  }
>();

export function registerToolUIRenderers(toolWithUI: ToolWithUI, keyName: string) {
  toolUIRegistry.set(keyName, {
    renderToolDoing: toolWithUI.renderToolDoing,
    renderToolResult: toolWithUI.renderToolResult,
  });
}

export function unregisterToolUIRenderers(keyName: string) {
  toolUIRegistry.delete(keyName);
}

/**
 * Register ToolWithUI renderers and return a tool definition for LLM usage.
 */
export function convertToolForAI(toolWithUI: ToolWithUI, keyName: string) {
  registerToolUIRenderers(toolWithUI, keyName);
  return toolWithUI;
}

/**
 * Get UI renderers for a tool
 */
export function getToolUIRenderers(toolName: string) {
  return toolUIRegistry.get(toolName);
}

/**
 * Register tool UI renderers and return the original tool definitions.
 */
export function convertToolsForAI(tools: Record<string, unknown>) {
  const adaptedTools: Record<string, unknown> = {};

  for (const [key, toolObj] of Object.entries(tools)) {
    if (toolObj && typeof toolObj === 'object') {
      // Check if it's a ToolWithUI
      if ('renderToolDoing' in toolObj && 'renderToolResult' in toolObj) {
        adaptedTools[key] = convertToolForAI(toolObj as ToolWithUI, key);
      } else {
        // Use directly without re-wrapping
        adaptedTools[key] = toolObj;
      }
    }
  }

  return adaptedTools;
}
