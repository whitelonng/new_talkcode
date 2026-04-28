// src/services/prompt/providers/skills-provider.ts

import { logger } from '@/lib/logger';
import { agentRegistry } from '@/services/agents/agent-registry';
import { getAgentSkillService } from '@/services/skills';
import { useAgentStore } from '@/stores/agent-store';
import { useConversationSkillsStore } from '@/stores/conversation-skills-store';
import type { PromptContextProvider, ResolveContext } from '@/types/prompt';
import type { AgentSkill } from '@/types/agent-skills-spec';

export const SkillsProvider: PromptContextProvider = {
  id: 'skills',
  label: 'Available Skills',
  description:
    'Injects available skills in XML format (name, description, location); full content loaded on-demand via get_skill tool',
  badges: ['Auto', 'Agent', 'Skills'],

  providedTokens() {
    return ['active_skills', 'skills_context'];
  },

  canResolve(token: string) {
    return token === 'active_skills' || token === 'skills_context';
  },

  async resolve(_token: string, ctx: ResolveContext): Promise<string | undefined> {
    try {
      const storeAgent = ctx.agentId
        ? useAgentStore.getState().agents.get(ctx.agentId)
        : undefined;
      const registryAgent =
        ctx.agentId && !storeAgent ? await agentRegistry.getWithResolvedTools(ctx.agentId) : undefined;
      const defaultSkillIds = storeAgent?.defaultSkills || registryAgent?.defaultSkills || [];
      const activeSkillIds = useConversationSkillsStore
        .getState()
        .resolveSkillIds(ctx.taskId, ctx.agentId, defaultSkillIds);

      const skillService = await getAgentSkillService();
      const allSkills = await skillService.listSkills();

      const skillsToUse = allSkills.filter((skill: AgentSkill) => {
        const isSystem = skill.frontmatter.metadata?.['talkcody.source'] === 'system';
        const isActive = activeSkillIds.includes(skill.name);
        return isSystem || isActive;
      });

      if (skillsToUse.length === 0) {
        return undefined;
      }

      const skillsXml: string[] = [];
      for (const skill of skillsToUse) {
        const location = `${skill.path}/SKILL.md`;
        const description =
          skill.frontmatter.description || 'Domain-specific knowledge and best practices';

        skillsXml.push('  <skill>');
        skillsXml.push(`    <name>${skill.name}</name>`);
        skillsXml.push(`    <description>${description}</description>`);
        skillsXml.push(`    <location>${location}</location>`);
        skillsXml.push('  </skill>');
      }

      return `<available_skills>\n${skillsXml.join('\n')}\n</available_skills>`;
    } catch (error) {
      logger.error('Failed to resolve skills context:', error);
      return undefined;
    }
  },

  injection: {
    enabledByDefault: true,
    placement: 'append',
    sectionTitle: 'Available Skills',
    sectionTemplate(values: Record<string, string>) {
      const content = values.skills_context || values.active_skills || '';
      if (!content) return '';

      const instructionsSection = `<skills_instructions>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively.

How to use skills:
- Each skill provides domain-specific knowledge, tools, and capabilities
- Skills are located at the path specified in <location>
- Read the full skill content using: readFile tool with the location path
- Execute skill scripts using: bash tool to run commands in the skill directory

Workflow:
1. Check available skills when a task matches their domain
2. Use readFile to read the skill's SKILL.md for detailed instructions and capabilities
3. Follow the skill's guidelines and best practices
4. Use bash tool to execute any scripts provided in the skill directory
5. Combine skill knowledge with your general capabilities

Important:
- Only use skills listed in <available_skills> below
</skills_instructions>

${content}`;

      return instructionsSection;
    },
  },
};
