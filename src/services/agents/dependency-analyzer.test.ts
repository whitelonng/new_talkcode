import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/agents/agent-registry', () => ({
  agentRegistry: {
    getWithResolvedTools: vi.fn(async (agentId: string) => {
      // Mock different agent types for testing
      if (agentId === 'explore') {
        return {
          id: 'explore',
          role: 'read',
          tools: {
            readFile: { execute: vi.fn() },
            codeSearch: { execute: vi.fn() },
            listFiles: { execute: vi.fn() },
          },
        };
      }
      if (agentId === 'coding') {
        return {
          id: 'coding',
          role: 'write',
          tools: {
            readFile: { execute: vi.fn() },
            writeFile: { execute: vi.fn() },
            editFile: { execute: vi.fn() },
          },
        };
      }
      if (agentId === 'general') {
        return {
          id: 'general',
          role: 'write',
          tools: {
            webSearch: { execute: vi.fn() },
          },
        };
      }
      return null;
    }),
  },
}));

vi.mock('@/lib/tools', () => ({
  getAllToolNames: vi.fn(() => [
    'readFile',
    'writeFile',
    'editFile',
    'codeSearch',
    'listFiles',
    'callAgent',
    'grepSearch',
    'webSearch',
  ]),
  getAllToolNamesWithCustom: vi.fn(() => [
    'readFile',
    'writeFile',
    'editFile',
    'codeSearch',
    'listFiles',
    'callAgent',
    'grepSearch',
    'webSearch',
  ]),
  getToolMetadata: vi.fn((toolName: string) => ({
    category: toolName === 'readFile' ? 'read' 
             : toolName === 'codeSearch' ? 'read'
             : toolName === 'listFiles' ? 'read'
             : toolName === 'writeFile' ? 'write'
             : toolName === 'editFile' ? 'edit'
             : 'other',
    canConcurrent: toolName !== 'non-concurrent' && toolName !== 'callAgent',
    fileOperation: false,
    renderDoingUI: true,
    getTargetFile: (input: any) => {
      const targets = input?.targets;
      if (Array.isArray(targets)) return targets;
      if (typeof targets === 'string') return targets;
      return null;
    },
  })),
}));

import { DependencyAnalyzer, isAgentExecutionPlan } from './dependency-analyzer';
import { MAX_PARALLEL_SUBAGENTS } from './agent-dependency-analyzer';
import type { ToolCallInfo } from './tool-executor';

const dependencyAnalyzer = new DependencyAnalyzer();

const concurrentCallAgentTool = {
  callAgent: { canConcurrent: true },
} as const;

describe('DependencyAnalyzer - Mixed Agent and Tool Calls', () => {
  it('allows mixed agent and tool calls using ToolDependencyAnalyzer', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'read-1', toolName: 'readFile', input: { path: 'src/a.ts' } },
      { toolCallId: 'agent-1', toolName: 'callAgent', input: { targets: ['src/b.ts'] } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);
    // Mixed calls use ToolDependencyAnalyzer, not AgentDependencyAnalyzer
    expect(isAgentExecutionPlan(plan)).toBe(false);
  });

  it('allows mixed agent variant and tool calls', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'search-1', toolName: 'grepSearch', input: { query: 'test' } },
      { toolCallId: 'agent-1', toolName: 'callAgent', input: {} },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);
    expect(isAgentExecutionPlan(plan)).toBe(false);
  });

  it('allows only callAgent calls without other tools', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'agent-1', toolName: 'callAgent', input: { agentId: 'explore', targets: ['src/a.ts'] } },
      { toolCallId: 'agent-2', toolName: 'callAgent', input: { agentId: 'coding', targets: ['src/b.ts'] } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);
    expect(isAgentExecutionPlan(plan)).toBe(true);
  });

  it('allows callAgent tool variants without other tools', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'agent-1', toolName: 'CallAgent', input: { agentId: 'explore', targets: ['src/a.ts'] } },
      { toolCallId: 'agent-2', toolName: 'call agent', input: { agentId: 'coding', targets: ['src/b.ts'] } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);
    expect(isAgentExecutionPlan(plan)).toBe(true);
  });

  it('allows only non-agent tools without agent calls', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'read-1', toolName: 'readFile', input: { path: 'src/a.ts' } },
      { toolCallId: 'write-1', toolName: 'writeFile', input: { path: 'src/b.ts' } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);
    expect(isAgentExecutionPlan(plan)).toBe(false);
  });
});

describe('DependencyAnalyzer - Agent Tool Analysis', () => {
  it('creates read-only stage for agents with only read tools', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'agent-1', toolName: 'callAgent', input: { agentId: 'explore', targets: ['src/a.ts'] } },
      { toolCallId: 'agent-2', toolName: 'callAgent', input: { agentId: 'explore', targets: ['src/b.ts'] } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);
    
    if (isAgentExecutionPlan(plan)) {
      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0].phase).toBe('read-stage');
      expect(plan.stages[0].groups[0].concurrent).toBe(true);
      expect(plan.summary.informationGatheringAgents).toBe(2);
      expect(plan.summary.contentModificationAgents).toBe(0);
    } else {
      throw new Error('Expected AgentExecutionPlan');
    }
  });

  it('creates write-operations stage for agents with write tools', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'agent-1', toolName: 'callAgent', input: { agentId: 'coding', targets: ['src/a.ts'] } },
      { toolCallId: 'agent-2', toolName: 'callAgent', input: { agentId: 'coding', targets: ['src/b.ts'] } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);
    
    if (isAgentExecutionPlan(plan)) {
      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0].phase).toBe('write-edit-stage');
      expect(plan.summary.informationGatheringAgents).toBe(0);
      expect(plan.summary.contentModificationAgents).toBe(2);
    } else {
      throw new Error('Expected AgentExecutionPlan');
    }
  });

  it('creates both stages for mixed agent types', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'agent-1', toolName: 'callAgent', input: { agentId: 'explore', targets: ['src/a.ts'] } },
      { toolCallId: 'agent-2', toolName: 'callAgent', input: { agentId: 'coding', targets: ['src/b.ts'] } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);
    
    if (isAgentExecutionPlan(plan)) {
      expect(plan.stages).toHaveLength(2);
      expect(plan.stages[0].phase).toBe('read-stage');
      expect(plan.stages[1].phase).toBe('write-edit-stage');
      expect(plan.summary.informationGatheringAgents).toBe(1);
      expect(plan.summary.contentModificationAgents).toBe(1);
    } else {
      throw new Error('Expected AgentExecutionPlan');
    }
  });

  it('handles target conflicts in write-capable agents', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'agent-1', toolName: 'callAgent', input: { agentId: 'coding', targets: ['src/shared.ts'] } },
      { toolCallId: 'agent-2', toolName: 'callAgent', input: { agentId: 'coding', targets: ['src/shared.ts'] } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);
    
    if (isAgentExecutionPlan(plan)) {
      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0].phase).toBe('write-edit-stage');
      // Should create separate groups due to target conflict
      expect(plan.stages[0].groups.length).toBeGreaterThan(1);
    } else {
      throw new Error('Expected AgentExecutionPlan');
    }
  });

  it('classifies agents with only "other" tools as write-capable to avoid dropping them', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'agent-1', toolName: 'callAgent', input: { agentId: 'general' } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, concurrentCallAgentTool as any);

    if (isAgentExecutionPlan(plan)) {
      expect(plan.summary.totalAgents).toBe(1);
      expect(plan.summary.informationGatheringAgents).toBe(0);
      expect(plan.summary.contentModificationAgents).toBe(1);
      expect(plan.summary.totalStages).toBe(1);
      expect(plan.stages[0].phase).toBe('write-edit-stage');
      expect(plan.stages[0].groups[0].agentCalls).toHaveLength(1);
    } else {
      throw new Error('Expected AgentExecutionPlan');
    }
  });
});

describe('DependencyAnalyzer - Tool-only Analysis', () => {
  it('uses ToolDependencyAnalyzer for non-agent tools', async () => {
    const toolCalls: ToolCallInfo[] = [
      { toolCallId: 'read-1', toolName: 'readFile', input: { path: 'src/a.ts' } },
      { toolCallId: 'write-1', toolName: 'writeFile', input: { path: 'src/b.ts' } },
    ];

    const plan = await dependencyAnalyzer.analyzeDependencies(toolCalls, {} as any);
    
    expect(isAgentExecutionPlan(plan)).toBe(false);
    if (!isAgentExecutionPlan(plan)) {
      expect(plan.stages).toHaveLength(2); // read stage + write stage
      expect(plan.stages[0].name).toBe('read-stage');
      expect(plan.stages[1].name).toBe('write-edit-stage');
    }
  });
});
