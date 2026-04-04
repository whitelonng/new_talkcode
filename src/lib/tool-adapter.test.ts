import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ToolInput, ToolOutput, ToolWithUI } from '@/types/tool';

// Mock logger before importing
import { mockLogger } from '@/test/mocks';
vi.mock('./logger', () => mockLogger);

import { convertToolForAI, convertToolsForAI, getToolUIRenderers } from './tool-adapter';

describe('tool-adapter', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('convertToolForAI', () => {
    it('should register tool renderer using keyName (matches AI SDK behavior)', () => {
      // Create mock render functions
      const mockRenderDoing = vi.fn((_params: ToolInput) => ({}) as React.ReactElement);
      const mockRenderResult = vi.fn(
        (_result: ToolOutput, _params: ToolInput) => ({}) as React.ReactElement
      );

      // Create a mock tool with UI
      const mockTool: ToolWithUI = {
        name: 'GrepTool',
        description: 'Search code',
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({ success: true }),
        renderToolDoing: mockRenderDoing,
        renderToolResult: mockRenderResult,
        canConcurrent: false,
      };

      // Convert tool with a keyName - this matches how AI SDK identifies tools
      convertToolForAI(mockTool, 'codeSearch');

      // The renderer should be registered under 'codeSearch' (the keyName that AI SDK uses)
      const renderersByKeyName = getToolUIRenderers('codeSearch');
      const renderersByToolName = getToolUIRenderers('GrepTool');

      expect(renderersByKeyName).toBeDefined();
      expect(renderersByKeyName?.renderToolDoing).toBe(mockRenderDoing);
      expect(renderersByKeyName?.renderToolResult).toBe(mockRenderResult);

      // Should NOT be found under internal tool name when keyName is provided
      expect(renderersByToolName).toBeUndefined();
    });

    it('should register multiple tools correctly using keyNames', () => {
      const mockRender1Doing = vi.fn((_params: ToolInput) => ({}) as React.ReactElement);
      const mockRender1Result = vi.fn(
        (_result: ToolOutput, _params: ToolInput) => ({}) as React.ReactElement
      );
      const mockRender2Doing = vi.fn((_params: ToolInput) => ({}) as React.ReactElement);
      const mockRender2Result = vi.fn(
        (_result: ToolOutput, _params: ToolInput) => ({}) as React.ReactElement
      );

      const tool1: ToolWithUI = {
        name: 'read-file',
        description: 'Read a file',
        inputSchema: z.object({ path: z.string() }),
        execute: async () => ({ content: 'file content' }),
        renderToolDoing: mockRender1Doing,
        renderToolResult: mockRender1Result,
        canConcurrent: false,
      };

      const tool2: ToolWithUI = {
        name: 'get-skill',
        description: 'Get skill',
        inputSchema: z.object({ skillName: z.string() }),
        execute: async () => ({ skill: 'test' }),
        renderToolDoing: mockRender2Doing,
        renderToolResult: mockRender2Result,
        canConcurrent: false,
      };

      // Register with keyNames that AI SDK will use
      convertToolForAI(tool1, 'readFile');
      convertToolForAI(tool2, 'getSkillTool');

      // Should be found by keyNames
      const renderer1 = getToolUIRenderers('readFile');
      const renderer2 = getToolUIRenderers('getSkillTool');

      expect(renderer1).toBeDefined();
      expect(renderer2).toBeDefined();
      expect(renderer1?.renderToolDoing).toBe(mockRender1Doing);
      expect(renderer2?.renderToolDoing).toBe(mockRender2Doing);
    });
  });

  describe('convertToolsForAI', () => {
    it('should register all tools with their registry keys (matches AI SDK behavior)', () => {
      const mockRender1Doing = vi.fn((_params: ToolInput) => ({}) as React.ReactElement);
      const mockRender1Result = vi.fn(
        (_result: ToolOutput, _params: ToolInput) => ({}) as React.ReactElement
      );
      const mockRender2Doing = vi.fn((_params: ToolInput) => ({}) as React.ReactElement);
      const mockRender2Result = vi.fn(
        (_result: ToolOutput, _params: ToolInput) => ({}) as React.ReactElement
      );

      const tools = {
        codeSearch: {
          name: 'GrepTool',
          description: 'Search code',
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({ results: [] }),
          renderToolDoing: mockRender1Doing,
          renderToolResult: mockRender1Result,
          canConcurrent: false,
        },
        readFile: {
          name: 'read-file',
          description: 'Read file',
          inputSchema: z.object({ path: z.string() }),
          execute: async () => ({ content: '' }),
          renderToolDoing: mockRender2Doing,
          renderToolResult: mockRender2Result,
          canConcurrent: false,
        },
      };

      convertToolsForAI(tools);

      // Should be found by registry keys (what AI SDK uses)
      expect(getToolUIRenderers('codeSearch')).toBeDefined();
      expect(getToolUIRenderers('readFile')).toBeDefined();

      // Should NOT be found by internal tool names
      expect(getToolUIRenderers('GrepTool')).toBeUndefined();
      expect(getToolUIRenderers('read-file')).toBeUndefined();
    });

    it('should handle non-ToolWithUI tools correctly', () => {
      const tools = {
        regularTool: {
          execute: async () => ({ result: 'ok' }),
          inputSchema: z.object({ input: z.string() }),
        },
      };

      // Should not throw error
      expect(() => convertToolsForAI(tools)).not.toThrow();

      // regularTool should not be in the UI registry
      expect(getToolUIRenderers('regularTool')).toBeUndefined();
    });
  });

  describe('getToolUIRenderers', () => {
    it('should return undefined for non-existent tools', () => {
      const renderers = getToolUIRenderers('non-existent-tool');
      expect(renderers).toBeUndefined();
    });

    it('should return renderers for registered tools', () => {
      const mockRenderDoing = vi.fn((_params: ToolInput) => ({}) as React.ReactElement);
      const mockRenderResult = vi.fn(
        (_result: ToolOutput, _params: ToolInput) => ({}) as React.ReactElement
      );

      const mockTool: ToolWithUI = {
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: z.object({}),
        execute: async () => ({ success: true }),
        renderToolDoing: mockRenderDoing,
        renderToolResult: mockRenderResult,
        canConcurrent: false,
      };

      convertToolForAI(mockTool, 'test-tool');

      const renderers = getToolUIRenderers('test-tool');
      expect(renderers).toBeDefined();
      expect(renderers?.renderToolDoing).toBe(mockRenderDoing);
      expect(renderers?.renderToolResult).toBe(mockRenderResult);
    });
  });
});
