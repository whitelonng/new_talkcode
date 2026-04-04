import { beforeEach, describe, expect, it } from 'vitest';
import type { ToolWithUI } from '@/types/tool';
import { getToolUIRenderers } from '@/lib/tool-adapter';
import { loadAllTools, replaceCustomToolsCache } from './index';

describe('tool UI registration', () => {
  beforeEach(async () => {
    await loadAllTools();
  });

  it('registers UI renderers for callAgent', () => {
    const renderers = getToolUIRenderers('callAgent');
    expect(renderers?.renderToolDoing).toBeDefined();
    expect(renderers?.renderToolResult).toBeDefined();
  });

  it('registers UI renderers when custom tools cache is replaced', () => {
    const renderToolDoing = () => null;
    const renderToolResult = () => null;

    const tool = {
      name: 'customTool',
      description: 'Custom Tool',
      inputSchema: {} as ToolWithUI['inputSchema'],
      execute: async () => 'ok',
      renderToolDoing,
      renderToolResult,
      canConcurrent: false,
    } satisfies ToolWithUI;

    replaceCustomToolsCache({ customTool: tool });

    const renderers = getToolUIRenderers('customTool');
    expect(renderers?.renderToolDoing).toBe(renderToolDoing);
    expect(renderers?.renderToolResult).toBe(renderToolResult);
  });

  it('updates UI renderers on subsequent custom tool refresh', () => {
    const renderToolDoingA = () => null;
    const renderToolResultA = () => null;
    const renderToolDoingB = () => null;
    const renderToolResultB = () => null;

    const toolA = {
      name: 'customToolRefresh',
      description: 'Custom Tool Refresh',
      inputSchema: {} as ToolWithUI['inputSchema'],
      execute: async () => 'ok',
      renderToolDoing: renderToolDoingA,
      renderToolResult: renderToolResultA,
      canConcurrent: false,
    } satisfies ToolWithUI;

    const toolB = {
      name: 'customToolRefresh',
      description: 'Custom Tool Refresh',
      inputSchema: {} as ToolWithUI['inputSchema'],
      execute: async () => 'ok',
      renderToolDoing: renderToolDoingB,
      renderToolResult: renderToolResultB,
      canConcurrent: false,
    } satisfies ToolWithUI;

    replaceCustomToolsCache({ customToolRefresh: toolA });
    replaceCustomToolsCache({ customToolRefresh: toolB });

    const renderers = getToolUIRenderers('customToolRefresh');
    expect(renderers?.renderToolDoing).toBe(renderToolDoingB);
    expect(renderers?.renderToolResult).toBe(renderToolResultB);
  });

  it('unregisters UI renderers when custom tools are removed', () => {
    const renderToolDoing = () => null;
    const renderToolResult = () => null;

    const tool = {
      name: 'customToolRemove',
      description: 'Custom Tool Remove',
      inputSchema: {} as ToolWithUI['inputSchema'],
      execute: async () => 'ok',
      renderToolDoing,
      renderToolResult,
      canConcurrent: false,
    } satisfies ToolWithUI;

    replaceCustomToolsCache({ customToolRemove: tool });
    replaceCustomToolsCache({});

    const renderers = getToolUIRenderers('customToolRemove');
    expect(renderers).toBeUndefined();
  });
});
