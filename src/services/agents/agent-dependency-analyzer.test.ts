import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentToolSet } from '@/types/agent';
import { AgentDependencyAnalyzer, MAX_PARALLEL_SUBAGENTS } from './agent-dependency-analyzer';
import type { ToolCallInfo } from './tool-executor';

// Mock agent registry
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
          tools: {
            webSearch: { execute: vi.fn() },
          },
        };
      }
      if (agentId === 'no-tools') {
        return {
          id: 'no-tools',
          tools: {},
        };
      }
      return null;
    }),
  },
}));

// Mock getToolMetadata
vi.mock('@/lib/tools', () => ({
  getToolMetadata: vi.fn((toolName: string) => ({
    category:
      toolName === 'readFile'
        ? 'read'
        : toolName === 'codeSearch'
          ? 'read'
          : toolName === 'listFiles'
            ? 'read'
            : toolName === 'writeFile'
              ? 'write'
              : toolName === 'editFile'
                ? 'edit'
                : 'other',
    canConcurrent: toolName !== 'non-concurrent' && toolName !== 'callAgent',
    fileOperation: false,
    renderDoingUI: true,
    getTargetFile: (input: { targets?: unknown }) => {
      const targets = input?.targets;
      if (Array.isArray(targets)) return targets;
      if (typeof targets === 'string') return targets;
      return null;
    },
  })),
}));

describe('AgentDependencyAnalyzer', () => {
  let analyzer: AgentDependencyAnalyzer;
  const mockTools: AgentToolSet = {
    callAgent: {
      execute: vi.fn(),
      inputSchema: { type: 'object' as const, properties: {} },
    },
  };

  beforeEach(() => {
    analyzer = new AgentDependencyAnalyzer();
    vi.clearAllMocks();
  });

  describe('analyzeDependencies', () => {
    it('returns empty plan for empty agent calls', async () => {
      const plan = await analyzer.analyzeDependencies([], mockTools);

      expect(plan.stages).toHaveLength(0);
      expect(plan.summary.totalAgents).toBe(0);
      expect(plan.summary.totalStages).toBe(0);
      expect(plan.summary.totalGroups).toBe(0);
    });

    it('throws error for non-agent tool calls', async () => {
      const toolCalls: ToolCallInfo[] = [
        { toolCallId: 'read-1', toolName: 'readFile', input: { path: 'src/a.ts' } },
      ];

      await expect(analyzer.analyzeDependencies(toolCalls, mockTools)).rejects.toThrow(
        /can only handle agent calls/
      );
    });

    it('throws error when mixing agent and non-agent calls', async () => {
      const toolCalls: ToolCallInfo[] = [
        { toolCallId: 'read-1', toolName: 'readFile', input: { path: 'src/a.ts' } },
        { toolCallId: 'agent-1', toolName: 'callAgent', input: { agentId: 'coding' } },
      ];

      await expect(analyzer.analyzeDependencies(toolCalls, mockTools)).rejects.toThrow(
        /can only handle agent calls/
      );
    });
  });

  describe('Read agents', () => {
    it('creates read-stage for read agents', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0].phase).toBe('read-stage');
      expect(plan.stages[0].name).toBe('read-stage');
      expect(plan.summary.informationGatheringAgents).toBe(1);
      expect(plan.summary.contentModificationAgents).toBe(0);
    });

    it('groups multiple read agents in single concurrent group', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/b.ts'] },
        },
        {
          toolCallId: 'agent-3',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/c.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0].groups).toHaveLength(1);
      expect(plan.stages[0].groups[0].concurrent).toBe(true);
      expect(plan.stages[0].groups[0].agentCalls).toHaveLength(3);
      expect(plan.summary.informationGatheringAgents).toBe(3);
    });

    it('respects MAX_PARALLEL_SUBAGENTS limit for read-stage', async () => {
      const toolCalls: ToolCallInfo[] = Array.from({ length: MAX_PARALLEL_SUBAGENTS + 2 }, (_, i) => ({
        toolCallId: `agent-${i}`,
        toolName: 'callAgent',
        input: { agentId: 'explore', targets: [`src/file${i}.ts`] },
      }));

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0].groups[0].maxConcurrency).toBe(MAX_PARALLEL_SUBAGENTS);
    });

    it('includes target files in read-stage group', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts', 'src/b.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].targetFiles).toEqual(['src/a.ts', 'src/b.ts']);
    });
  });

  describe('Write agents', () => {
    it('creates write-edit-stage for write agents', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/a.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0].phase).toBe('write-edit-stage');
      expect(plan.summary.contentModificationAgents).toBe(1);
    });

    it('separates write agents with target conflicts', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/shared.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/shared.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(1);
      // Should create separate groups due to target conflict
      expect(plan.stages[0].groups.length).toBeGreaterThan(1);
      // Each group should have only one agent due to conflict
      plan.stages[0].groups.forEach((group) => {
        expect(group.agentCalls.length).toBe(1);
      });
    });

    it('groups write agents without target conflicts', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/a.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/b.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0].groups).toHaveLength(1);
      expect(plan.stages[0].groups[0].concurrent).toBe(true);
      expect(plan.stages[0].groups[0].agentCalls).toHaveLength(2);
    });

    it('runs callAgent without targets sequentially for safety', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding' }, // No targets
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0].groups[0].concurrent).toBe(false);
      expect(plan.stages[0].groups[0].maxConcurrency).toBe(1);
    });

    it('respects MAX_PARALLEL_SUBAGENTS limit for write-edit-stage', async () => {
      const toolCalls: ToolCallInfo[] = Array.from({ length: MAX_PARALLEL_SUBAGENTS + 2 }, (_, i) => ({
        toolCallId: `agent-${i}`,
        toolName: 'callAgent',
        input: { agentId: 'coding', targets: [`src/file${i}.ts`] },
      }));

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(1);
      // First group should have maxConcurrency set to MAX_PARALLEL_SUBAGENTS
      expect(plan.stages[0].groups[0].maxConcurrency).toBe(MAX_PARALLEL_SUBAGENTS);
    });
  });

  describe('Mixed agent types', () => {
    it('creates both read and write-edit stages for mixed agents', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/b.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(2);
      expect(plan.stages[0].phase).toBe('read-stage');
      expect(plan.stages[1].phase).toBe('write-edit-stage');
      expect(plan.summary.informationGatheringAgents).toBe(1);
      expect(plan.summary.contentModificationAgents).toBe(1);
    });

    it('orders stages correctly: read-stage before write-edit-stage', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/b.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages).toHaveLength(2);
      expect(plan.stages[0].phase).toBe('read-stage');
      expect(plan.stages[1].phase).toBe('write-edit-stage');
    });
  });

  describe('Agent role inference', () => {
    it('uses explicit role from agent definition', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore' },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.informationGatheringAgents).toBe(1);
      expect(plan.summary.contentModificationAgents).toBe(0);
    });

    it('infers role from tools when explicit role not defined', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'general' }, // No explicit role, has webSearch tool
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      // Should be treated as write (default for unknown tools)
      expect(plan.summary.contentModificationAgents).toBe(1);
    });

    it('treats agents with no tools as write for safety', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'no-tools' },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.contentModificationAgents).toBe(1);
    });

    it('treats agents without agentId as write for safety', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: {}, // No agentId
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.contentModificationAgents).toBe(1);
    });

    it('treats agents with undefined definition as write for safety', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'non-existent-agent' },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.contentModificationAgents).toBe(1);
    });
  });

  describe('Target extraction', () => {
    it('extracts targets from agent input', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/a.ts', 'src/b.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].targetFiles).toEqual(['src/a.ts', 'src/b.ts']);
    });

    it('handles single target as string', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: 'src/a.ts' },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].targetFiles).toContain('src/a.ts');
    });

    it('ignores empty or whitespace targets', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/a.ts', '', '  ', 'src/b.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      const targets = plan.stages[0].groups[0].targetFiles;
      expect(targets).toContain('src/a.ts');
      expect(targets).toContain('src/b.ts');
      expect(targets?.length).toBe(2);
    });

    it('deduplicates targets', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/a.ts', 'src/a.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].targetFiles).toEqual(['src/a.ts']);
    });
  });

  describe('Execution plan summary', () => {
    it('calculates correct summary statistics', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/b.ts'] },
        },
        {
          toolCallId: 'agent-3',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/c.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.totalAgents).toBe(3);
      expect(plan.summary.totalStages).toBe(2);
      expect(plan.summary.informationGatheringAgents).toBe(2);
      expect(plan.summary.contentModificationAgents).toBe(1);
      expect(plan.summary.concurrentGroups).toBeGreaterThan(0);
    });

    it('counts concurrent groups correctly', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/b.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.concurrentGroups).toBe(1);
    });
  });

  describe('Group reasoning', () => {
    it('provides reason for read-stage grouping', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].reason).toContain('parallel');
    });

    it('provides reason for target conflict separation', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/shared.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/shared.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      const reasons = plan.stages[0].groups.map((g) => g.reason);
      expect(reasons.some((r) => r.includes('conflict'))).toBe(true);
    });

    it('provides reason for missing targets safety', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding' }, // No targets
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].reason).toContain('safety');
    });
  });

  describe('callAgent vs callAgent', () => {
    it('handles callAgent tool calls', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore' },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.totalAgents).toBe(1);
    });

    it('handles mixed callAgent and callAgent', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore' },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/a.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.totalAgents).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('handles very large number of agents', async () => {
      const toolCalls: ToolCallInfo[] = Array.from({ length: 100 }, (_, i) => ({
        toolCallId: `agent-${i}`,
        toolName: 'callAgent',
        input: { agentId: 'explore', targets: [`src/file${i}.ts`] },
      }));

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.totalAgents).toBe(100);
      expect(plan.stages).toHaveLength(1);
    });

    it('handles agents with multiple targets', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: {
            agentId: 'coding',
            targets: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
          },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].targetFiles).toHaveLength(3);
    });

    it('handles agents with overlapping targets', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/a.ts', 'src/shared.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/shared.ts', 'src/b.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      // Should create separate groups due to shared target
      expect(plan.stages[0].groups.length).toBeGreaterThan(1);
    });

    it('detects directory containment conflict - parent contains child', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/utils/helper.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      // Should create separate groups due to directory containment
      expect(plan.stages[0].groups.length).toBeGreaterThan(1);
    });

    it('detects directory containment conflict - child within parent', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/components/Button.tsx'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/components/'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      // Should create separate groups due to directory containment
      expect(plan.stages[0].groups.length).toBeGreaterThan(1);
    });

    it('allows parallel execution for non-overlapping directories', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/components/'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/services/'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      // Should run in parallel - no containment conflict
      expect(plan.stages[0].groups.length).toBe(1);
      expect(plan.stages[0].groups[0].concurrent).toBe(true);
      expect(plan.stages[0].groups[0].agentCalls).toHaveLength(2);
    });

    it('handles trailing slashes consistently', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/utils'] }, // no trailing slash
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/utils/'] }, // with trailing slash
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      // Should detect as same path (conflict)
      expect(plan.stages[0].groups.length).toBeGreaterThan(1);
    });

    it('handles null or undefined targets gracefully', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: null },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: undefined },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.summary.totalAgents).toBe(2);
      // Both should run sequentially due to missing targets
      expect(plan.stages[0].groups.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Group ID generation', () => {
    it('generates unique group IDs', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/a.ts'] },
        },
        {
          toolCallId: 'agent-2',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/b.ts'] },
        },
        {
          toolCallId: 'agent-3',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/c.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      const groupIds = plan.stages.flatMap((s) => s.groups.map((g) => g.id));
      const uniqueIds = new Set(groupIds);
      expect(uniqueIds.size).toBe(groupIds.length);
    });

    it('includes stage name in group ID', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].id).toContain('read');
    });
  });

  describe('Agent role assignment in groups', () => {
    it('assigns correct agentRole to read-stage groups', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'explore', targets: ['src/a.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].agentRole).toBe('read');
    });

    it('assigns correct agentRole to write-edit-stage groups', async () => {
      const toolCalls: ToolCallInfo[] = [
        {
          toolCallId: 'agent-1',
          toolName: 'callAgent',
          input: { agentId: 'coding', targets: ['src/a.ts'] },
        },
      ];

      const plan = await analyzer.analyzeDependencies(toolCalls, mockTools);

      expect(plan.stages[0].groups[0].agentRole).toBe('write');
    });
  });
});
