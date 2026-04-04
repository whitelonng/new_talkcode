// Fork skill functionality
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import type { Skill } from '@/types/skill';
import type { SkillDatabaseService } from '../database/skill-database-service';

/**
 * Fork an existing skill to create a new one
 * @param sourceSkillId - ID of the skill to fork
 * @param dbService - Database service instance
 * @returns ID of the newly created skill, or null if failed
 */
export async function forkSkill(
  sourceSkillId: string,
  dbService: SkillDatabaseService
): Promise<string | null> {
  try {
    const sourceSkill = await dbService.getSkill(sourceSkillId);

    if (!sourceSkill) {
      logger.error(`Cannot fork skill: source skill ${sourceSkillId} not found`);
      return null;
    }

    const now = Date.now();
    const newId = uuidv4();

    // Generate fork name
    let newName = `${sourceSkill.name} (Fork)`;

    // Check if a fork with this name already exists
    const allSkills = await dbService.listSkills();
    const existingForkCount = allSkills.filter(
      (s) => s.name.startsWith(sourceSkill.name) && s.name.includes('(Fork')
    ).length;

    if (existingForkCount > 0) {
      newName = `${sourceSkill.name} (Fork ${existingForkCount + 1})`;
    }

    // Determine source type and forking metadata
    const isMarketplaceSkill = Boolean(sourceSkill.marketplace?.marketplaceId);
    const isLocalSkill = !isMarketplaceSkill && !sourceSkill.metadata.isBuiltIn;

    // Create forked skill definition
    const forkedSkill: Skill = {
      id: newId,
      name: newName,
      description: sourceSkill.description || '',
      longDescription: sourceSkill.longDescription,
      category: sourceSkill.category,
      icon: sourceSkill.icon,
      content: {
        systemPromptFragment: sourceSkill.content.systemPromptFragment,
        workflowRules: sourceSkill.content.workflowRules,
        documentation: sourceSkill.content.documentation
          ? JSON.parse(JSON.stringify(sourceSkill.content.documentation))
          : undefined,
      },
      metadata: {
        isBuiltIn: false, // Forked skills are never built-in
        sourceType: 'local', // Forks are always local
        forkedFromId: isLocalSkill ? sourceSkillId : undefined,
        forkedFromMarketplaceId: isMarketplaceSkill
          ? sourceSkill.marketplace?.marketplaceId
          : undefined,
        isShared: false, // Newly forked skills are not shared
        tags: [...(sourceSkill.metadata.tags || [])],
        createdAt: now,
        updatedAt: now,
      },
    };

    // Save the forked skill to database
    await dbService.createSkill(forkedSkill);

    logger.info(
      `Successfully forked skill "${sourceSkill.name}" (${sourceSkillId}) to "${newName}" (${newId})`
    );
    return newId;
  } catch (error) {
    logger.error(`Failed to fork skill ${sourceSkillId}:`, error);
    return null;
  }
}
