// src/services/prompt/providers/skills-provider.ts

import { logger } from '@/lib/logger';
import { getAgentSkillService } from '@/services/skills/agent-skill-service';
import { useSkillsStore } from '@/stores/skills-store';
import type { PromptContextProvider, ResolveContext } from '@/types/prompt';

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

  async resolve(_token: string, _ctx: ResolveContext): Promise<string | undefined> {
    try {
      // Get global active skills from the skills store
      const activeSkillIds = useSkillsStore.getState().getActiveSkills();

      // Get agent skill service
      const skillService = await getAgentSkillService();

      // Load all skills
      const allSkills = await skillService.listSkills();

      // Filter: system skills are always included + active user skills
      const skillsToUse = allSkills.filter((skill) => {
        const isSystem = skill.frontmatter.metadata?.['talkcody.source'] === 'system';
        const isActive = activeSkillIds && activeSkillIds.includes(skill.name);
        return isSystem || isActive;
      });

      if (!skillsToUse || skillsToUse.length === 0) {
        return undefined;
      }

      // Build XML format skills information (name + description + location)
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

      // Return XML format
      return `<available_skills>\n${skillsXml.join('\n')}\n</available_skills>`;
    } catch (error) {
      logger.error('Failed to resolve skills context:', error);
      return undefined;
    }
  },

  injection: {
    enabledByDefault: true,
    placement: 'append', // Append skills after agent's base prompt
    sectionTitle: 'Available Skills',
    sectionTemplate(values: Record<string, string>) {
      const content = values.skills_context || values.active_skills || '';
      if (!content) return '';

      // Build the complete skills context with instructions
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
