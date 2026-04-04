// src/services/database/skill-database-service.ts

import { logger } from '@/lib/logger';
import type { Skill, SkillContent, SkillFilter, SkillSortOption, TaskSkill } from '@/types/skill';
import type { TursoClient } from './turso-client';

/**
 * Database service for skills
 * Handles all low-level database operations for skills
 */
export class SkillDatabaseService {
  constructor(private db: TursoClient) {}

  // ==================== Skills CRUD ====================

  /**
   * Create a new skill
   */
  async createSkill(skill: Skill): Promise<void> {
    const now = Date.now();

    try {
      await this.db.execute(
        `INSERT INTO skills (
          id, name, description, long_description, category, icon_url,
          system_prompt_fragment, workflow_rules, documentation,
          marketplace_id, marketplace_version, author_name, author_id,
          downloads, rating, last_synced_at,
          is_built_in, tags, created_at, updated_at, last_used_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19, $20, $21
        )`,
        [
          skill.id,
          skill.name,
          skill.description,
          skill.longDescription || null,
          skill.category,
          skill.icon || null,
          skill.content.systemPromptFragment || null,
          skill.content.workflowRules || null,
          skill.content.documentation ? JSON.stringify(skill.content.documentation) : null,
          skill.marketplace?.marketplaceId || null,
          skill.marketplace?.version || null,
          skill.marketplace?.author || null,
          skill.marketplace?.authorId || null,
          skill.marketplace?.downloads || 0,
          skill.marketplace?.rating || 0,
          skill.marketplace?.lastSynced || null,
          skill.metadata.isBuiltIn ? 1 : 0,
          JSON.stringify(skill.metadata.tags || []),
          skill.metadata.createdAt || now,
          skill.metadata.updatedAt || now,
          skill.metadata.lastUsed || null,
        ]
      );

      logger.info(`Created skill: ${skill.id}`);
    } catch (error) {
      logger.error(`Failed to create skill ${skill.id}:`, error);
      throw error;
    }
  }

  /**
   * Get a skill by ID
   */
  async getSkill(id: string): Promise<Skill | null> {
    try {
      const results = await this.db.select<any[]>('SELECT * FROM skills WHERE id = $1', [id]);

      if (results.length === 0) {
        return null;
      }

      return this.mapRowToSkill(results[0]);
    } catch (error) {
      logger.error(`Failed to get skill ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update a skill
   */
  async updateSkill(id: string, updates: Partial<Skill>): Promise<void> {
    const now = Date.now();

    try {
      const existing = await this.getSkill(id);
      if (!existing) {
        throw new Error(`Skill ${id} not found`);
      }

      // Build update query dynamically based on provided updates
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }

      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }

      if (updates.longDescription !== undefined) {
        setClauses.push(`long_description = $${paramIndex++}`);
        values.push(updates.longDescription || null);
      }

      if (updates.category !== undefined) {
        setClauses.push(`category = $${paramIndex++}`);
        values.push(updates.category);
      }

      if (updates.icon !== undefined) {
        setClauses.push(`icon_url = $${paramIndex++}`);
        values.push(updates.icon || null);
      }

      if (updates.content) {
        if (updates.content.systemPromptFragment !== undefined) {
          setClauses.push(`system_prompt_fragment = $${paramIndex++}`);
          values.push(updates.content.systemPromptFragment || null);
        }

        if (updates.content.workflowRules !== undefined) {
          setClauses.push(`workflow_rules = $${paramIndex++}`);
          values.push(updates.content.workflowRules || null);
        }

        if (updates.content.documentation !== undefined) {
          setClauses.push(`documentation = $${paramIndex++}`);
          values.push(
            updates.content.documentation ? JSON.stringify(updates.content.documentation) : null
          );
        }
      }

      if (updates.metadata?.tags !== undefined) {
        setClauses.push(`tags = $${paramIndex++}`);
        values.push(JSON.stringify(updates.metadata.tags));
      }

      // Always update updated_at
      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(now);

      // Add id to the end
      values.push(id);

      const query = `UPDATE skills SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;

      await this.db.execute(query, values);

      logger.info(`Updated skill: ${id}`);
    } catch (error) {
      logger.error(`Failed to update skill ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a skill
   */
  async deleteSkill(id: string): Promise<void> {
    try {
      await this.db.execute('DELETE FROM skills WHERE id = $1', [id]);
      logger.info(`Deleted skill: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete skill ${id}:`, error);
      throw error;
    }
  }

  /**
   * List skills with optional filters and sorting
   */
  async listSkills(filter?: SkillFilter, sort?: SkillSortOption): Promise<Skill[]> {
    try {
      let query = 'SELECT * FROM skills WHERE 1=1';
      const values: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (filter?.category) {
        query += ` AND category = $${paramIndex++}`;
        values.push(filter.category);
      }

      if (filter?.isBuiltIn !== undefined) {
        query += ` AND is_built_in = $${paramIndex++}`;
        values.push(filter.isBuiltIn ? 1 : 0);
      }

      if (filter?.search) {
        const searchValue = `%${filter.search}%`;
        query += ` AND (name LIKE $${paramIndex++} OR description LIKE $${paramIndex++})`;
        values.push(searchValue, searchValue);
      }

      if (filter?.tags && filter.tags.length > 0) {
        // Simple tag filtering - check if any tag is in the JSON array
        const tagConditions = filter.tags.map((tag) => `tags LIKE '%"${tag}"%'`);
        query += ` AND (${tagConditions.join(' OR ')})`;
      }

      // Apply sorting
      switch (sort) {
        case 'name':
          query += ' ORDER BY name ASC';
          break;
        case 'downloads':
          query += ' ORDER BY downloads DESC';
          break;
        case 'rating':
          query += ' ORDER BY rating DESC';
          break;
        case 'recent':
          query += ' ORDER BY created_at DESC';
          break;
        case 'updated':
          query += ' ORDER BY updated_at DESC';
          break;
        default:
          query += ' ORDER BY name ASC';
      }

      const results = await this.db.select<any[]>(query, values);
      return results.map((row) => this.mapRowToSkill(row));
    } catch (error) {
      logger.error('Failed to list skills:', error);
      throw error;
    }
  }

  // ==================== Task-Skill Association ====================

  /**
   * Get skills for a task
   */
  async getTaskSkills(taskId: string): Promise<TaskSkill[]> {
    try {
      const results = await this.db.select<any[]>(
        `SELECT * FROM conversation_skills
         WHERE conversation_id = $1
         ORDER BY priority DESC`,
        [taskId]
      );

      return results.map((row) => ({
        taskId: row.conversation_id,
        skillId: row.skill_id,
        enabled: Boolean(row.enabled),
        priority: row.priority,
        activatedAt: row.activated_at,
      }));
    } catch (error) {
      logger.error(`Failed to get task skills for ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Enable a skill for a task
   */
  async enableSkillForTask(taskId: string, skillId: string, priority = 0): Promise<void> {
    const now = Date.now();

    try {
      // Check if association already exists
      const existing = await this.db.select<any[]>(
        'SELECT * FROM conversation_skills WHERE conversation_id = $1 AND skill_id = $2',
        [taskId, skillId]
      );

      if (existing.length > 0) {
        // Update existing association
        await this.db.execute(
          'UPDATE conversation_skills SET enabled = 1, priority = $1 WHERE conversation_id = $2 AND skill_id = $3',
          [priority, taskId, skillId]
        );
      } else {
        // Create new association
        await this.db.execute(
          `INSERT INTO conversation_skills (conversation_id, skill_id, enabled, priority, activated_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [taskId, skillId, 1, priority, now]
        );
      }

      // Update last_used_at for the skill
      await this.db.execute('UPDATE skills SET last_used_at = $1 WHERE id = $2', [now, skillId]);

      logger.info(`Enabled skill ${skillId} for task ${taskId}`);
    } catch (error) {
      logger.error(`Failed to enable skill for task:`, error);
      throw error;
    }
  }

  /**
   * Disable a skill for a task
   */
  async disableSkillForTask(taskId: string, skillId: string): Promise<void> {
    try {
      await this.db.execute(
        'UPDATE conversation_skills SET enabled = 0 WHERE conversation_id = $1 AND skill_id = $2',
        [taskId, skillId]
      );

      logger.info(`Disabled skill ${skillId} for task ${taskId}`);
    } catch (error) {
      logger.error(`Failed to disable skill for task:`, error);
      throw error;
    }
  }

  /**
   * Remove a skill association from a task
   */
  async removeSkillFromTask(taskId: string, skillId: string): Promise<void> {
    try {
      await this.db.execute(
        'DELETE FROM conversation_skills WHERE conversation_id = $1 AND skill_id = $2',
        [taskId, skillId]
      );

      logger.info(`Removed skill ${skillId} from task ${taskId}`);
    } catch (error) {
      logger.error(`Failed to remove skill from task:`, error);
      throw error;
    }
  }

  /**
   * Set all skills for a task (replaces existing)
   */
  async setTaskSkills(taskId: string, skillIds: string[]): Promise<void> {
    const now = Date.now();

    try {
      // Delete existing associations
      await this.db.execute('DELETE FROM conversation_skills WHERE conversation_id = $1', [taskId]);

      // Insert new associations
      for (let i = 0; i < skillIds.length; i++) {
        const skillId = skillIds[i];
        const priority = skillIds.length - i; // Higher index = higher priority

        await this.db.execute(
          `INSERT INTO conversation_skills (conversation_id, skill_id, enabled, priority, activated_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [taskId, skillId, 1, priority, now]
        );
      }

      logger.info(`Set ${skillIds.length} skills for task ${taskId}`);
    } catch (error) {
      logger.error(`Failed to set task skills:`, error);
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Map database row to Skill object
   */
  private mapRowToSkill(row: any): Skill {
    const content: SkillContent = {
      systemPromptFragment: row.system_prompt_fragment || undefined,
      workflowRules: row.workflow_rules || undefined,
      documentation: row.documentation ? JSON.parse(row.documentation) : undefined,
    };

    const skill: Skill = {
      id: row.id,
      name: row.name,
      description: row.description,
      longDescription: row.long_description || undefined,
      category: row.category,
      icon: row.icon_url || undefined,
      content,
      metadata: {
        isBuiltIn: Boolean(row.is_built_in),
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsed: row.last_used_at || undefined,
      },
    };

    // Add marketplace metadata if present
    if (row.marketplace_id) {
      skill.marketplace = {
        marketplaceId: row.marketplace_id,
        version: row.marketplace_version,
        author: row.author_name,
        authorId: row.author_id,
        downloads: row.downloads,
        rating: row.rating,
        lastSynced: row.last_synced_at || undefined,
      };
    }

    return skill;
  }

  /**
   * Get skills statistics
   */
  async getSkillsStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
  }> {
    try {
      // Get total count
      const totalResult = await this.db.select<any[]>('SELECT COUNT(*) as count FROM skills');
      const total = totalResult[0]?.count || 0;

      // Get count by category
      const categoryResults = await this.db.select<any[]>(
        'SELECT category, COUNT(*) as count FROM skills GROUP BY category'
      );

      const byCategory: Record<string, number> = {};
      for (const row of categoryResults) {
        byCategory[row.category] = row.count;
      }

      return { total, byCategory };
    } catch (error) {
      logger.error('Failed to get skills stats:', error);
      throw error;
    }
  }
}
