// src/services/skills/skill-service.ts

import { join } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { simpleFetch } from '@/lib/tauri-fetch';
import type {
  CreateSkillRequest,
  DocumentationItem,
  Skill,
  SkillFilter,
  SkillSortOption,
  SkillStats,
  TaskSkill,
  UpdateSkillRequest,
} from '@/types/skill';
import { SkillDatabaseService } from '../database/skill-database-service';

/**
 * High-level service for managing skills
 * Handles business logic, documentation resolution, and marketplace integration
 */
export class SkillService {
  constructor(private dbService: SkillDatabaseService) {}

  // ==================== CRUD Operations ====================

  /**
   * Create a new skill
   */
  async createSkill(request: CreateSkillRequest): Promise<Skill> {
    const now = Date.now();

    const skill: Skill = {
      id: uuidv4(),
      name: request.name,
      description: request.description,
      longDescription: request.longDescription,
      category: request.category,
      icon: request.icon,
      content: request.content,
      metadata: {
        isBuiltIn: false,
        tags: request.tags || [],
        createdAt: now,
        updatedAt: now,
      },
    };

    await this.dbService.createSkill(skill);
    logger.info(`Created skill: ${skill.name} (${skill.id})`);

    return skill;
  }

  /**
   * Update an existing skill
   */
  async updateSkill(id: string, request: UpdateSkillRequest): Promise<Skill> {
    const existing = await this.dbService.getSkill(id);
    if (!existing) {
      throw new Error(`Skill ${id} not found`);
    }

    // Build update object
    const updates: Partial<Skill> = {};

    if (request.name !== undefined) {
      updates.name = request.name;
    }

    if (request.description !== undefined) {
      updates.description = request.description;
    }

    if (request.longDescription !== undefined) {
      updates.longDescription = request.longDescription;
    }

    if (request.category !== undefined) {
      updates.category = request.category;
    }

    if (request.icon !== undefined) {
      updates.icon = request.icon;
    }

    if (request.content !== undefined) {
      updates.content = {
        ...existing.content,
        ...request.content,
      };
    }

    if (request.tags !== undefined) {
      updates.metadata = {
        ...existing.metadata,
        tags: request.tags,
      };
    }

    await this.dbService.updateSkill(id, updates);

    // Fetch and return updated skill
    const updated = await this.dbService.getSkill(id);
    if (!updated) {
      throw new Error(`Failed to fetch updated skill ${id}`);
    }

    logger.info(`Updated skill: ${updated.name} (${id})`);
    return updated;
  }

  /**
   * Delete a skill
   * Handles both database skills and agent skills
   *
   * @param id - Skill ID (UUID for database skills, skill name for agent skills)
   * @param sourceType - Optional hint about skill type ('database' | 'agent')
   */
  async deleteSkill(id: string, sourceType?: 'database' | 'agent'): Promise<void> {
    // ✅ Simplified logic with early returns

    // If source type is provided, use it directly
    if (sourceType === 'database') {
      await this.dbService.deleteSkill(id);
      logger.info(`Deleted database skill: ${id}`);
      return;
    }

    if (sourceType === 'agent') {
      const { getAgentSkillService } = await import('./agent-skill-service');
      const agentService = await getAgentSkillService();
      await agentService.deleteSkill(id);
      logger.info(`Deleted agent skill: ${id}`);
      return;
    }

    // Auto-detect: Try database first (faster lookup)
    const dbSkill = await this.dbService.getSkill(id);
    if (dbSkill) {
      await this.dbService.deleteSkill(id);
      logger.info(`Deleted database skill: ${id}`);
      return;
    }

    // Try agent skills (name-based lookup)
    const { getAgentSkillService } = await import('./agent-skill-service');
    const agentService = await getAgentSkillService();
    const agentSkill = await agentService.getSkillByName(id);

    if (agentSkill) {
      await agentService.deleteSkill(agentSkill.name);
      logger.info(`Deleted agent skill: ${id}`);
      return;
    }

    // Not found anywhere
    throw new Error(`Skill "${id}" not found`);
  }

  /**
   * Get a skill by ID
   */
  async getSkill(id: string): Promise<Skill | null> {
    return this.dbService.getSkill(id);
  }

  /**
   * List skills with optional filters and sorting
   */
  async listSkills(filter?: SkillFilter, sort?: SkillSortOption): Promise<Skill[]> {
    return this.dbService.listSkills(filter, sort);
  }

  // ==================== Task Association ====================

  /**
   * Get skills associated with a task
   */
  async getTaskSkills(taskId: string): Promise<TaskSkill[]> {
    return this.dbService.getTaskSkills(taskId);
  }

  /**
   * Get active (enabled) skills for a task with full skill data
   */
  async getActiveSkillsForTask(taskId: string): Promise<Skill[]> {
    const taskSkills = await this.dbService.getTaskSkills(taskId);

    // Filter enabled skills and sort by priority
    const activeTaskSkills = taskSkills
      .filter((ts: TaskSkill) => ts.enabled)
      .sort((a: TaskSkill, b: TaskSkill) => b.priority - a.priority);

    // Fetch full skill data
    const skills: Skill[] = [];
    for (const ts of activeTaskSkills) {
      const skill = await this.dbService.getSkill(ts.skillId);
      if (skill) {
        skills.push(skill);
      }
    }

    return skills;
  }

  /**
   * Enable a skill for a task
   */
  async enableSkillForTask(taskId: string, skillId: string, priority?: number): Promise<void> {
    await this.dbService.enableSkillForTask(taskId, skillId, priority);
    logger.info(`Enabled skill ${skillId} for task ${taskId}`);
  }

  /**
   * Disable a skill for a task
   */
  async disableSkillForTask(taskId: string, skillId: string): Promise<void> {
    await this.dbService.disableSkillForTask(taskId, skillId);
    logger.info(`Disabled skill ${skillId} for task ${taskId}`);
  }

  /**
   * Toggle skill status for a task
   */
  async toggleSkillForTask(taskId: string, skillId: string): Promise<boolean> {
    const taskSkills = await this.dbService.getTaskSkills(taskId);
    const existing = taskSkills.find((ts: TaskSkill) => ts.skillId === skillId);

    if (!existing) {
      // Enable if not exists
      await this.enableSkillForTask(taskId, skillId);
      return true;
    }

    if (existing.enabled) {
      // Disable if currently enabled
      await this.disableSkillForTask(taskId, skillId);
      return false;
    }

    // Enable if currently disabled
    await this.enableSkillForTask(taskId, skillId);
    return true;
  }

  /**
   * Set skills for a task (replaces existing)
   */
  async setTaskSkills(taskId: string, skillIds: string[]): Promise<void> {
    await this.dbService.setTaskSkills(taskId, skillIds);
    logger.info(`Set ${skillIds.length} skills for task ${taskId}`);
  }

  // ==================== Documentation Resolution ====================

  /**
   * Resolve documentation content based on type
   * - inline: Return content directly
   * - file: Read from local file system
   * - url: Fetch from remote URL
   */
  async resolveDocumentation(doc: DocumentationItem, projectRootPath?: string): Promise<string> {
    try {
      switch (doc.type) {
        case 'inline':
          return doc.content || '';

        case 'file': {
          if (!doc.filePath) {
            throw new Error('File path is required for file type documentation');
          }

          // If projectRootPath is provided, join it with filePath
          const fullPath = projectRootPath
            ? await join(projectRootPath, doc.filePath)
            : doc.filePath;

          try {
            const content = await readTextFile(fullPath);
            return content;
          } catch (error) {
            logger.error(`Failed to read file ${fullPath}:`, error);
            return `[Failed to load file: ${doc.filePath}]`;
          }
        }

        case 'url':
          if (!doc.url) {
            throw new Error('URL is required for url type documentation');
          }

          try {
            // Use simpleFetch to bypass CORS restrictions in Tauri WebView
            const response = await simpleFetch(doc.url);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const content = await response.text();
            return content;
          } catch (error) {
            logger.error(`Failed to fetch URL ${doc.url}:`, error);
            return `[Failed to fetch URL: ${doc.url}]`;
          }

        default:
          logger.warn(`Unknown documentation type: ${(doc as any).type}`);
          return '';
      }
    } catch (error) {
      logger.error('Failed to resolve documentation:', error);
      return `[Failed to resolve documentation: ${doc.title}]`;
    }
  }

  /**
   * Get complete skill content with resolved documentation
   */
  async getSkillContent(skillId: string, projectRootPath?: string): Promise<string> {
    const skill = await this.dbService.getSkill(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    const sections: string[] = [];

    // Add skill header
    sections.push(`# Skill: ${skill.name}`);
    if (skill.description) {
      sections.push(skill.description);
    }
    sections.push(''); // Empty line

    // Add system prompt fragment
    if (skill.content.systemPromptFragment) {
      sections.push('## Domain Knowledge\n');
      sections.push(skill.content.systemPromptFragment);
      sections.push(''); // Empty line
    }

    // Add workflow rules
    if (skill.content.workflowRules) {
      sections.push('## Workflow Rules\n');
      sections.push(skill.content.workflowRules);
      sections.push(''); // Empty line
    }

    // Add documentation
    if (skill.content.documentation && skill.content.documentation.length > 0) {
      sections.push('## Reference Documentation\n');

      for (const doc of skill.content.documentation) {
        sections.push(`### ${doc.title}\n`);
        const content = await this.resolveDocumentation(doc, projectRootPath);
        sections.push(content);
        sections.push(''); // Empty line
      }
    }

    return sections.join('\n');
  }

  // ==================== Marketplace Integration ====================
  // Note: These methods are placeholders for Phase 5 implementation

  /**
   * Install a skill from marketplace
   */
  async installFromMarketplace(_marketplaceId: string): Promise<Skill> {
    // TODO: Phase 5 - Implement marketplace API integration
    throw new Error('Marketplace integration not yet implemented');
  }

  /**
   * Update a skill from marketplace
   */
  async updateFromMarketplace(_skillId: string): Promise<Skill> {
    // TODO: Phase 5 - Implement marketplace update
    throw new Error('Marketplace integration not yet implemented');
  }

  /**
   * Publish a skill to marketplace
   */
  async publishToMarketplace(_skillId: string): Promise<string> {
    // TODO: Phase 5 - Implement marketplace publishing
    throw new Error('Marketplace integration not yet implemented');
  }

  // ==================== Statistics ====================

  /**
   * Record skill usage
   */
  async recordSkillUsage(skillId: string): Promise<void> {
    const now = Date.now();
    await this.dbService.updateSkill(skillId, {
      metadata: {
        lastUsed: now,
        isBuiltIn: false,
        tags: [],
        createdAt: Date.now(),
        updatedAt: now,
      },
    });
  }

  /**
   * Get skills statistics
   */
  async getSkillsStats(): Promise<SkillStats> {
    const stats = await this.dbService.getSkillsStats();

    // Get most used skills
    const allSkills = await this.dbService.listSkills();
    const mostUsed = allSkills
      .filter((s) => s.metadata.lastUsed)
      .sort((a, b) => (b.metadata.lastUsed || 0) - (a.metadata.lastUsed || 0))
      .slice(0, 5)
      .map((s) => ({
        skillId: s.id,
        name: s.name,
        usageCount: s.metadata.lastUsed || 0, // Using lastUsed as proxy for now
      }));

    return {
      ...stats,
      mostUsed,
    };
  }
}

// Singleton instance
let instance: SkillService | null = null;

/**
 * Get the SkillService singleton instance
 * If dbService is not provided, it will be created automatically
 */
export async function getSkillService(dbService?: SkillDatabaseService): Promise<SkillService> {
  if (!instance) {
    if (!dbService) {
      const { databaseService } = await import('../database-service');
      await databaseService.initialize();
      const db = await databaseService.getDb();
      dbService = new SkillDatabaseService(db);
    }
    instance = new SkillService(dbService);
  } else if (dbService) {
    // If dbService is provided and instance exists, update the underlying service
    instance = new SkillService(dbService);
  }
  return instance;
}
