/**
 * Centralized tool registry
 *
 * To add a new tool:
 * 1. Create the tool file in src/lib/tools/your-tool.tsx
 * 2. Add an entry here in TOOL_DEFINITIONS
 * 3. Import the tool at the top of this file
 *
 * That's it! The tool will be automatically registered and available.
 */

import { clearToolRegistryCache } from '@/services/agents/tool-registry';
import { loadCustomToolsForRegistry } from '@/services/tools/custom-tool-service';
import { getEffectiveWorkspaceRoot } from '@/services/workspace-root-service';
import { settingsManager } from '@/stores/settings-store';
import type { ToolWithUI } from '@/types/tool';
import { logger } from '../logger';
import { registerToolUIRenderers, unregisterToolUIRenderers } from '../tool-adapter';
import { askUserQuestionsTool } from './ask-user-questions-tool';
import { bashTool } from './bash-tool';
import { browserBlurTool } from './browser-blur-tool';
import { browserCheckTool } from './browser-check-tool';
import { browserClearConsoleTool } from './browser-clear-console-tool';
import { browserClearNetworkLogsTool } from './browser-clear-network-logs-tool';
import { browserClickTool } from './browser-click-tool';
import { browserControlTool } from './browser-control-tool';
import { browserExecuteScriptTool } from './browser-execute-script-tool';
import { browserEvaluateExpressionTool } from './browser-evaluate-expression-tool';
import { browserFocusTool } from './browser-focus-tool';
import { browserGetConsoleTool } from './browser-get-console-tool';
import { browserGetConsoleErrorsTool } from './browser-get-console-errors-tool';
import { browserGetElementInfoTool } from './browser-get-element-info-tool';
import { browserGetNetworkLogsTool } from './browser-get-network-logs-tool';
import { browserGetPageStateTool } from './browser-get-page-state-tool';
import { browserGetRequestDetailTool } from './browser-get-request-detail-tool';
import { browserGetDomTreeTool } from './browser-get-dom-tree-tool';
import { browserHighlightElementTool } from './browser-highlight-element-tool';
import { browserHoverTool } from './browser-hover-tool';
import { browserListInteractiveElementsTool } from './browser-list-interactive-elements-tool';
import { browserNavigateTool } from './browser-navigate-tool';
import { browserFindNetworkRequestTool } from './browser-find-network-request-tool';
import { browserPressKeyTool } from './browser-press-key-tool';
import { browserQueryElementsTool } from './browser-query-elements-tool';
import { browserScrollTool } from './browser-scroll-tool';
import { browserSelectOptionTool } from './browser-select-option-tool';
import { browserSnapshotTool } from './browser-snapshot-tool';
import { browserTypeTool } from './browser-type-tool';
import { browserUncheckTool } from './browser-uncheck-tool';
import { browserWaitForNavigationTool } from './browser-wait-for-navigation-tool';
import { browserWaitForElementStateTool } from './browser-wait-for-element-state-tool';
import { browserWaitForTextTool } from './browser-wait-for-text-tool';
import { browserWaitForTool } from './browser-wait-for-tool';

import { callAgent } from './call-agent-tool';
import { codeSearch } from './code-search-tool';
import { editFile } from './edit-file-tool';
import { exitPlanModeTool } from './exit-plan-mode-tool';
import { githubPRTool } from './github-pr-tool';
import { globTool } from './glob-tool';
import { imageGenerationTool } from './image-generation-tool';
import { installSkill } from './install-skill-tool';
import { listFiles } from './list-files-tool';
import { lspTool } from './lsp-tool';
import { memoryRead } from './memory-read-tool';
import { getProjectMemoryTargetCandidates } from './memory-targets';
import { memoryWrite } from './memory-write-tool';
import { readFile } from './read-file-tool';
import { testCustomTool } from './test-custom-tool';
import { todoWriteTool } from './todo-write-tool';
import { webFetchTool } from './web-fetch-tool';
import { webSearchTool } from './web-search-tool';
import { writeFile } from './write-file-tool';

export type ToolCategory = 'read' | 'write' | 'edit' | 'other';

export interface ToolMetadata {
  /** Category of the tool: read, write, edit, or other */
  category: ToolCategory;
  /** Whether this tool can run concurrently with tools of the same type */
  canConcurrent: boolean;
  /** Whether this tool operates on files */
  fileOperation: boolean;
  /** Extract target file path(s) from tool input for dependency analysis */
  getTargetFile?: (input: Record<string, unknown>) => string | string[] | null;
  /** Whether to render "doing" UI for this tool. Set to false for fast operations to avoid UI flash. Default: true */
  renderDoingUI?: boolean;
  /** Whether to always show the tool result UI expanded by default */
  showResultUIAlways?: boolean;
}

export interface ToolDefinition {
  /** Direct reference to the tool */
  tool: ToolWithUI;
  /** Display label for UI */
  label: string;
  /** Tool metadata for dependency analysis */
  metadata: ToolMetadata;
}

/**
 * Central registry of all tools
 *
 * Add new tools here - they will be automatically loaded and registered
 */
export const TOOL_DEFINITIONS = {
  // Read-only tools
  readFile: {
    tool: readFile,
    label: 'Read File',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: true,
      getTargetFile: (input) => (input?.file_path as string) || null,
      renderDoingUI: false,
    },
  },
  // Other read-only tools
  glob: {
    tool: globTool,
    label: 'Glob',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: false,
    },
  },
  imageGeneration: {
    tool: imageGenerationTool,
    label: 'Image Generation',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },

  codeSearch: {
    tool: codeSearch,
    label: 'Code Search',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: false,
    },
  },
  installSkill: {
    tool: installSkill,
    label: 'Install Skill',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  listFiles: {
    tool: listFiles,
    label: 'List Files',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: false,
    },
  },
  lsp: {
    tool: lspTool,
    label: 'LSP',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: true,
      getTargetFile: (input) => (input?.filePath as string) || null,
      renderDoingUI: true,
    },
  },
  memoryRead: {
    tool: memoryRead,
    label: 'Memory Read',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },

  // Write tools
  writeFile: {
    tool: writeFile,
    label: 'Write File',
    metadata: {
      category: 'write' as ToolCategory,
      canConcurrent: false,
      fileOperation: true,
      renderDoingUI: true,
      getTargetFile: (input) => (input?.file_path as string) || null,
    },
  },
  memoryWrite: {
    tool: memoryWrite,
    label: 'Memory Write',
    metadata: {
      category: 'write' as ToolCategory,
      canConcurrent: false,
      fileOperation: true,
      renderDoingUI: true,
      getTargetFile: (input) => {
        const scope = input?.scope;
        const target = input?.target;
        const fileName = typeof input?.file_name === 'string' ? input.file_name : undefined;
        if (scope === 'global') {
          return target === 'topic' && fileName
            ? `appData://memory/global/${fileName}`
            : 'appData://memory/global/MEMORY.md';
        }
        return getProjectMemoryTargetCandidates(settingsManager.getCurrentRootPath(), fileName);
      },
    },
  },

  // Edit tools
  editFile: {
    tool: editFile,
    label: 'Edit File',
    metadata: {
      category: 'edit' as ToolCategory,
      canConcurrent: false,
      fileOperation: true,
      renderDoingUI: true,
      getTargetFile: (input) => (input?.file_path as string) || null,
    },
  },

  // Other tools
  askUserQuestions: {
    tool: askUserQuestionsTool,
    label: 'Ask User Questions',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  exitPlanMode: {
    tool: exitPlanModeTool,
    label: 'Exit Plan Mode',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  bash: {
    tool: bashTool,
    label: 'Bash',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserControl: {
    tool: browserControlTool,
    label: 'Browser Control',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: false,
    },
  },
  browserCheck: {
    tool: browserCheckTool,
    label: 'Browser Check',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserClearConsole: {
    tool: browserClearConsoleTool,
    label: 'Browser Clear Console',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserClearNetworkLogs: {
    tool: browserClearNetworkLogsTool,
    label: 'Browser Clear Network Logs',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserNavigate: {
    tool: browserNavigateTool,
    label: 'Browser Navigate',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserClick: {
    tool: browserClickTool,
    label: 'Browser Click',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserType: {
    tool: browserTypeTool,
    label: 'Browser Type',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserExecuteScript: {
    tool: browserExecuteScriptTool,
    label: 'Browser Execute Script',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserEvaluateExpression: {
    tool: browserEvaluateExpressionTool,
    label: 'Browser Evaluate Expression',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserFocus: {
    tool: browserFocusTool,
    label: 'Browser Focus',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserBlur: {
    tool: browserBlurTool,
    label: 'Browser Blur',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserHover: {
    tool: browserHoverTool,
    label: 'Browser Hover',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserSnapshot: {
    tool: browserSnapshotTool,
    label: 'Browser Snapshot',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserWaitFor: {
    tool: browserWaitForTool,
    label: 'Browser Wait For',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserWaitForElementState: {
    tool: browserWaitForElementStateTool,
    label: 'Browser Wait For Element State',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserWaitForNavigation: {
    tool: browserWaitForNavigationTool,
    label: 'Browser Wait For Navigation',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserWaitForText: {
    tool: browserWaitForTextTool,
    label: 'Browser Wait For Text',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserScroll: {
    tool: browserScrollTool,
    label: 'Browser Scroll',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserSelectOption: {
    tool: browserSelectOptionTool,
    label: 'Browser Select Option',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserGetConsole: {
    tool: browserGetConsoleTool,
    label: 'Browser Get Console',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserGetConsoleErrors: {
    tool: browserGetConsoleErrorsTool,
    label: 'Browser Get Console Errors',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserGetElementInfo: {
    tool: browserGetElementInfoTool,
    label: 'Browser Get Element Info',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserGetNetworkLogs: {
    tool: browserGetNetworkLogsTool,
    label: 'Browser Get Network Logs',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserFindNetworkRequest: {
    tool: browserFindNetworkRequestTool,
    label: 'Browser Find Network Request',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserGetRequestDetail: {
    tool: browserGetRequestDetailTool,
    label: 'Browser Get Request Detail',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserGetPageState: {
    tool: browserGetPageStateTool,
    label: 'Browser Get Page State',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserGetDomTree: {
    tool: browserGetDomTreeTool,
    label: 'Browser Get DOM Tree',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserHighlightElement: {
    tool: browserHighlightElementTool,
    label: 'Browser Highlight Element',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserListInteractiveElements: {
    tool: browserListInteractiveElementsTool,
    label: 'Browser List Interactive Elements',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserPressKey: {
    tool: browserPressKeyTool,
    label: 'Browser Press Key',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserQueryElements: {
    tool: browserQueryElementsTool,
    label: 'Browser Query Elements',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  browserUncheck: {
    tool: browserUncheckTool,
    label: 'Browser Uncheck',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  callAgent: {
    tool: callAgent,
    label: 'Call Agent',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
      getTargetFile: (input) => {
        const targets = (input as { targets?: unknown })?.targets;
        if (Array.isArray(targets)) {
          return targets
            .map((t) => (typeof t === 'string' ? t.trim() : null))
            .filter((t): t is string => !!t && t.length > 0);
        }
        if (typeof targets === 'string') {
          const trimmed = targets.trim();
          return trimmed.length > 0 ? trimmed : null;
        }
        return null;
      },
    },
  },

  test_custom_tool: {
    tool: testCustomTool,
    label: 'Test Custom Tool',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  todoWrite: {
    tool: todoWriteTool,
    label: 'Todo',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: false,
      fileOperation: false,
      renderDoingUI: false,
    },
  },
  webSearch: {
    tool: webSearchTool,
    label: 'Web Search',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  webFetch: {
    tool: webFetchTool,
    label: 'Web Fetch',
    metadata: {
      category: 'other' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
  githubPR: {
    tool: githubPRTool,
    label: 'GitHub PR',
    metadata: {
      category: 'read' as ToolCategory,
      canConcurrent: true,
      fileOperation: false,
      renderDoingUI: true,
    },
  },
} as const satisfies Record<string, ToolDefinition>;

export type ToolName = keyof typeof TOOL_DEFINITIONS;

// Cache for loaded tools
let toolsCache: Record<string, ToolWithUI> | null = null;
let loadingPromise: Promise<Record<string, ToolWithUI>> | null = null;
let customToolsCache: Record<string, ToolWithUI> = {};

/**
 * Check if tools have been loaded (without throwing)
 * Useful for components that need to check before accessing tools
 */
export function areToolsLoaded(): boolean {
  return toolsCache !== null;
}

/**
 * Load all tools from the registry
 * Tools are cached after first load
 */
export async function loadAllTools(): Promise<Record<string, ToolWithUI>> {
  // Return cached tools if available
  if (toolsCache) {
    return toolsCache;
  }

  // If already loading, return the existing promise
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start loading
  loadingPromise = (async () => {
    const tools: Record<string, ToolWithUI> = {};

    for (const [toolName, definition] of Object.entries(TOOL_DEFINITIONS)) {
      try {
        // Use direct tool reference
        const tool = definition.tool;

        if (!tool) {
          logger.error(`Tool "${toolName}" not found in definition`);
          continue;
        }

        // Ensure UI renderers are registered even if agents are not yet converted
        registerToolUIRenderers(tool, toolName);

        tools[toolName] = tool;
      } catch (error) {
        logger.error(`Failed to load tool "${toolName}":`, error);
      }
    }

    try {
      const rootPath = await getEffectiveWorkspaceRoot('');
      await settingsManager.initialize();
      const customDirectory = settingsManager.get('custom_tools_dir');

      const customState = await loadCustomToolsForRegistry({
        workspaceRoot: rootPath || undefined,
        customDirectory: customDirectory || undefined,
      });

      for (const tool of customState.tools) {
        registerToolUIRenderers(tool, tool.name);
        tools[tool.name] = tool;
        customToolsCache[tool.name] = tool;
      }
    } catch (error) {
      logger.warn('Failed to load custom tools during registry load', error);
    }

    logger.info(`Loaded ${Object.keys(tools).length} tools successfully into registry`);
    toolsCache = tools;
    loadingPromise = null;
    return tools;
  })();

  return loadingPromise;
}

/**
 * Synchronous access to tools (only works if tools are already loaded)
 * Throws error if tools haven't been loaded yet
 *
 * Use loadAllTools() first in async context, or use this after app initialization
 */
export function getAllToolsSync(): Record<string, ToolWithUI> {
  if (!toolsCache) {
    throw new Error(
      'Tools not loaded yet. Call await loadAllTools() first or ensure tools are preloaded at app startup.'
    );
  }
  return toolsCache;
}

/**
 * Get a specific tool synchronously (only works if tools are already loaded)
 */
export function getToolSync(toolName: ToolName): ToolWithUI {
  const tools = getAllToolsSync();
  const tool = tools[toolName];
  if (!tool) {
    throw new Error(`Tool "${toolName}" not found`);
  }
  return tool;
}

/**
 * Get a specific tool by name
 */
export async function getTool(toolName: ToolName): Promise<ToolWithUI | undefined> {
  const tools = await loadAllTools();
  return tools[toolName];
}

/**
 * Get tool metadata by name
 */
export function getToolMetadata(toolName: string): ToolMetadata {
  const definition = TOOL_DEFINITIONS[toolName as ToolName];
  if (definition) {
    return definition.metadata;
  }

  const customTool = customToolsCache[toolName];
  if (customTool) {
    return {
      category: 'other',
      canConcurrent: customTool.canConcurrent ?? false,
      fileOperation: false,
      renderDoingUI: true,
      showResultUIAlways: customTool.showResultUIAlways ?? false,
    };
  }

  // Return default metadata for unknown tools
  return {
    category: 'other',
    canConcurrent: false,
    fileOperation: false,
    renderDoingUI: true,
    showResultUIAlways: false,
  };
}

/**
 * Get tool label by name
 */
export function getToolLabel(toolName: string): string {
  const definition = TOOL_DEFINITIONS[toolName as ToolName];
  return definition?.label || toolName;
}

/**
 * Get all tool names
 */
export function getAllToolNames(): ToolName[] {
  return Object.keys(TOOL_DEFINITIONS) as ToolName[];
}

export function getAllToolNamesWithCustom(): string[] {
  const base = getAllToolNames() as string[];
  const custom = Object.keys(customToolsCache);
  return [...new Set([...base, ...custom])];
}

export function replaceCustomToolsCache(tools: Record<string, ToolWithUI>) {
  const previousToolNames = Object.keys(customToolsCache);
  customToolsCache = { ...tools };

  for (const toolName of previousToolNames) {
    if (!(toolName in customToolsCache)) {
      unregisterToolUIRenderers(toolName);
    }
  }

  for (const [toolName, tool] of Object.entries(customToolsCache)) {
    registerToolUIRenderers(tool, toolName);
  }
  if (toolsCache) {
    for (const toolName of previousToolNames) {
      if (!(toolName in customToolsCache)) {
        delete toolsCache[toolName];
      }
    }
    toolsCache = { ...toolsCache, ...customToolsCache };
  }
  // Clear tool registry cache to ensure agents get the latest tool definitions
  clearToolRegistryCache();
}

/**
 * Check if a tool name is valid
 */
export function isValidToolName(toolName: string): boolean {
  return toolName in TOOL_DEFINITIONS || toolName in customToolsCache;
}

/**
 * Get all tools formatted for UI display (async version)
 */
export async function getToolsForUI(): Promise<
  Array<{
    id: string;
    label: string;
    ref: ToolWithUI;
  }>
> {
  const tools = await loadAllTools();

  const result: Array<{
    id: string;
    label: string;
    ref: ToolWithUI;
  }> = [];

  const entries = Object.entries(TOOL_DEFINITIONS) as Array<[string, ToolDefinition]>;

  for (const [id, definition] of entries) {
    const tool = tools[id];
    if (tool !== undefined) {
      result.push({
        id,
        label: definition.label,
        ref: tool,
      });
    }
  }

  for (const [toolName, tool] of Object.entries(customToolsCache)) {
    result.push({
      id: toolName,
      label: toolName,
      ref: tool,
    });
  }

  return result;
}

/**
 * Get all tools formatted for UI display (synchronous version)
 * Only works after tools have been preloaded
 */
export function getToolsForUISync(): Array<{
  id: string;
  label: string;
  ref: ToolWithUI;
}> {
  const tools = getAllToolsSync();

  const result: Array<{
    id: string;
    label: string;
    ref: ToolWithUI;
  }> = [];

  const entries = Object.entries(TOOL_DEFINITIONS) as Array<[string, ToolDefinition]>;

  for (const [id, definition] of entries) {
    const tool = tools[id];
    if (tool !== undefined) {
      result.push({
        id,
        label: definition.label,
        ref: tool,
      });
    }
  }

  for (const [toolName, tool] of Object.entries(customToolsCache)) {
    result.push({
      id: toolName,
      label: toolName,
      ref: tool,
    });
  }

  return result;
}
