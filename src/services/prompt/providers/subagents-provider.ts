// src/services/prompt/providers/subagents-provider.ts

import { logger } from '@/lib/logger';
import type { PromptContextProvider, ResolveContext } from '@/types/prompt';

/**
 * Subagents Provider
 * Injects the list of available subagents into the system prompt
 *
 * This provider dynamically loads the agent registry and filters
 * agents that can be called as subagents (canBeSubagent !== false)
 */
export const SubagentsProvider: PromptContextProvider = {
  id: 'subagents',
  label: 'Available Subagents',
  description: 'Injects the list of available subagents for the callAgent tool',
  badges: ['Auto', 'Agents'],

  providedTokens() {
    return ['subagents_list'];
  },

  canResolve(token: string) {
    return token === 'subagents_list';
  },

  async resolve(_token: string, ctx: ResolveContext): Promise<string | undefined> {
    try {
      // Lazy import to avoid circular dependencies
      const { agentRegistry } = await import('@/services/agents/agent-registry');
      await agentRegistry.loadAllAgents();

      const agents = agentRegistry
        .list()
        // Filter: only agents that can be subagents AND not the current agent
        .filter((agent) => {
          // Default canBeSubagent to true if not specified
          const canBeSub = agent.canBeSubagent !== false;
          // Exclude the current agent to prevent self-calls
          const notSelf = agent.id !== ctx.agentId;
          return canBeSub && notSelf;
        })
        .map((agent) => {
          const name = agent.id || agent.name;
          const description = agent.description?.trim() || 'No description available';
          return `- **${name}**: ${description}`;
        });

      if (agents.length === 0) {
        return '- No subagents available';
      }

      return agents.join('\n');
    } catch (error) {
      logger.error('SubagentsProvider: Failed to load agent list:', error);
      return undefined;
    }
  },

  injection: {
    enabledByDefault: true,
    placement: 'append',
    sectionTitle: 'Available Subagents',
    sectionTemplate(values: Record<string, string>) {
      const content = values.subagents_list || '';
      if (!content) return '';

      return [
        '====',
        '# Available Subagents',
        '',
        'The following agents are available for delegation via the `callAgent` tool.',
        'Pick the best-fit subagent for each task (do not assume only one exists):',
        '',
        content,
        '',
        '## Delegation Guidelines',
        '',
        '- **Choose wisely**: Select the agent best suited for the specific task',
        '- **Provide context**: Subagents start with empty context; pass all necessary information',
        '- **Set targets**: Specify files/modules to avoid conflicts in parallel execution',
        '- **Batch independent tasks**: Run multiple subagents in parallel when tasks are independent',
        '====',
      ].join('\n');
    },
  },
};
