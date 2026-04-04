import { create } from 'zustand';
import { logger } from '@/lib/logger';
import { activeSkillsConfigService } from '@/services/active-skills-config-service';
import {
  type AgentSkill,
  getAgentSkillService,
  getSkillService,
  type Skill,
  type SkillFilter,
  type SkillSortOption,
} from '@/services/skills';

/**
 * Convert AgentSkill to Skill format for UI compatibility
 */
function convertAgentSkillToSkill(agentSkill: AgentSkill): Skill {
  const now = Date.now();
  const metadata = agentSkill.frontmatter.metadata || {};

  return {
    id: agentSkill.name, // Use name as ID for Agent Skills
    name: agentSkill.name,
    description: agentSkill.frontmatter.description,
    longDescription: agentSkill.frontmatter.description, // Agent Skills don't have separate long description
    category: metadata.category || 'general',
    icon: undefined, // Agent Skills Spec doesn't include icon in frontmatter
    content: {
      systemPromptFragment: agentSkill.content,
      workflowRules: undefined,
      documentation: agentSkill.directory.referenceFiles.map((file: string) => ({
        filename: file,
        type: 'file' as const,
        title: file,
      })),
      hasScripts: agentSkill.directory.hasScriptsDir,
      scriptFiles: agentSkill.directory.scriptFiles,
    },
    metadata: {
      isBuiltIn: false,
      sourceType: 'local',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    localPath: agentSkill.path,
  };
}

interface SkillsState {
  skills: Skill[];
  activeSkillIds: Set<string>; // Global active skills list
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface SkillsStore extends SkillsState {
  // Skills actions
  loadSkills: (filter?: SkillFilter, sort?: SkillSortOption) => Promise<void>;
  refreshSkills: (filter?: SkillFilter, sort?: SkillSortOption) => Promise<void>;

  // Active skills actions
  loadActiveSkills: () => Promise<void>;
  toggleSkill: (skillId: string) => Promise<void>;
  isSkillActive: (skillId: string) => boolean;
  getActiveSkills: () => string[];
  setActiveSkills: (skillIds: string[]) => Promise<void>;
  cleanupActiveSkills: () => Promise<void>;
}

export const useSkillsStore = create<SkillsStore>((set, get) => ({
  // Initial state
  skills: [],
  activeSkillIds: new Set<string>(),
  isLoading: false,
  error: null,
  isInitialized: false,

  /**
   * Load skills from both database and file system
   * Only loads once unless explicitly refreshed
   */
  loadSkills: async (filter?: SkillFilter, sort?: SkillSortOption) => {
    const { isInitialized, isLoading } = get();

    // Prevent duplicate loading
    if (isInitialized || isLoading) {
      return;
    }

    try {
      set({ isLoading: true, error: null });

      // Load Agent Skills (new format - Agent Skills Specification)
      const agentService = await getAgentSkillService();
      const agentSkills = await agentService.listSkills();
      const convertedAgentSkills = agentSkills.map(convertAgentSkillToSkill);

      // Load database skills (marketplace)
      const dbService = await getSkillService();
      const dbSkills = await dbService.listSkills(filter, sort);

      // Merge both types of skills
      const allSkills = [...convertedAgentSkills, ...dbSkills];

      set({
        skills: allSkills,
        isLoading: false,
        isInitialized: true,
      });
      logger.info(
        `Loaded ${allSkills.length} skills successfully (${agentSkills.length} Agent Skills, ${dbSkills.length} from DB)`
      );

      // Clean up active skills that no longer exist
      await get().cleanupActiveSkills();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load skills';
      logger.error('Failed to load skills:', errorMessage);
      if (error instanceof Error) {
        logger.error('Error stack:', error.stack);
      }
      set({
        error: errorMessage,
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  /**
   * Force refresh skills from both database and file system
   * Used when skills are created, updated, or deleted
   */
  refreshSkills: async (filter?: SkillFilter, sort?: SkillSortOption) => {
    try {
      set({ isLoading: true, error: null });

      // Load Agent Skills (new format - Agent Skills Specification)
      const agentService = await getAgentSkillService();
      const agentSkills = await agentService.listSkills();
      const convertedAgentSkills = agentSkills.map(convertAgentSkillToSkill);

      // Load database skills (marketplace)
      const dbService = await getSkillService();
      const dbSkills = await dbService.listSkills(filter, sort);

      // Merge both types of skills
      const allSkills = [...convertedAgentSkills, ...dbSkills];

      set({
        skills: allSkills,
        isLoading: false,
      });
      logger.info(
        `Refreshed ${allSkills.length} skills successfully (${agentSkills.length} Agent Skills, ${dbSkills.length} from DB)`
      );

      // Clean up active skills that no longer exist
      await get().cleanupActiveSkills();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh skills';
      logger.error('Failed to refresh skills:', errorMessage);
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  /**
   * Load active skills from config file
   */
  loadActiveSkills: async () => {
    try {
      const activeSkills = await activeSkillsConfigService.loadActiveSkills();
      set({ activeSkillIds: new Set(activeSkills) });
      logger.info(`Loaded ${activeSkills.length} active skills from config`);
    } catch (error) {
      logger.error('Failed to load active skills:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load active skills' });
    }
  },

  /**
   * Toggle a skill active/inactive
   */
  toggleSkill: async (skillId: string) => {
    const { activeSkillIds } = get();
    const newActiveSkills = new Set(activeSkillIds);

    if (newActiveSkills.has(skillId)) {
      newActiveSkills.delete(skillId);
    } else {
      newActiveSkills.add(skillId);
    }

    try {
      await activeSkillsConfigService.saveActiveSkills(Array.from(newActiveSkills));
      set({ activeSkillIds: newActiveSkills });
      logger.info(`Toggled skill ${skillId}, now ${newActiveSkills.size} active skills`);
    } catch (error) {
      logger.error('Failed to toggle skill:', error);
      throw error;
    }
  },

  /**
   * Check if a skill is active
   */
  isSkillActive: (skillId: string) => {
    return get().activeSkillIds.has(skillId);
  },

  /**
   * Get all active skill IDs as array
   */
  getActiveSkills: () => {
    return Array.from(get().activeSkillIds);
  },

  /**
   * Set active skills
   */
  setActiveSkills: async (skillIds: string[]) => {
    try {
      await activeSkillsConfigService.saveActiveSkills(skillIds);
      set({ activeSkillIds: new Set(skillIds) });
      logger.info(`Set ${skillIds.length} active skills`);
    } catch (error) {
      logger.error('Failed to set active skills:', error);
      throw error;
    }
  },

  /**
   * Clean up active skills that no longer exist in the skills list
   * This fixes the bug where deleted skills remain in active list
   */
  cleanupActiveSkills: async () => {
    const { skills, activeSkillIds } = get();
    const existingSkillIds = new Set(skills.map((s) => s.id));
    const validActiveIds = Array.from(activeSkillIds).filter((id) => existingSkillIds.has(id));

    // If some active skills no longer exist, update the config
    if (validActiveIds.length !== activeSkillIds.size) {
      const removedCount = activeSkillIds.size - validActiveIds.length;
      logger.info(`Cleaning up ${removedCount} invalid active skill IDs`);

      try {
        await activeSkillsConfigService.saveActiveSkills(validActiveIds);
        set({ activeSkillIds: new Set(validActiveIds) });
        logger.info(`Updated active skills: ${validActiveIds.length} remaining`);
      } catch (error) {
        logger.error('Failed to cleanup active skills:', error);
      }
    }
  },
}));
