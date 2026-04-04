// Skill management service for CRUD operations

import type { CreateSkillRequest, UpdateSkillRequest } from '@talkcody/shared';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  categories,
  marketplaceSkills,
  skillCategories,
  skillTags,
  skillVersions,
  tags,
} from '../db/schema';
import type { CategoryRecord } from '../types/database';

export class SkillService {
  /**
   * Create a new skill (publish to marketplace)
   */
  async createSkill(userId: string, data: CreateSkillRequest) {
    // Generate slug from name
    const slug = this.generateSlug(data.name);

    // Check if slug already exists
    const existing = await db
      .select()
      .from(marketplaceSkills)
      .where(eq(marketplaceSkills.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Skill with this name already exists');
    }

    let skillId: string | null = null;

    try {
      // Step 1: Validate and get category UUIDs first
      let categoryRecords: CategoryRecord[] = [];
      if (data.categories && data.categories.length > 0) {
        categoryRecords = await db
          .select()
          .from(categories)
          .where(
            sql`${categories.slug} IN (${sql.join(
              data.categories.map((id: string) => sql`${id}`),
              sql`, `
            )})`
          );

        if (categoryRecords.length === 0) {
          throw new Error('No valid categories found');
        }
      }

      // Step 2: Create skill
      const skill = await db
        .insert(marketplaceSkills)
        .values({
          slug,
          name: data.name,
          description: data.description,
          longDescription: data.longDescription || null,
          authorId: userId,
          systemPromptFragment: data.systemPromptFragment || null,
          workflowRules: data.workflowRules || null,
          documentation: data.documentation,
          latestVersion: '1.0.0',
          iconUrl: data.iconUrl || null,
          isPublished: false, // Draft by default
          // R2 storage fields
          storageUrl: data.storageUrl || null,
          packageSize: data.packageSize || null,
          checksum: data.checksum || null,
          hasScripts: data.hasScripts ? 1 : 0,
          // Agent Skills Specification fields
          compatibility: data.compatibility || null,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        })
        .returning();

      skillId = skill[0].id;

      // Step 3: Create initial version
      await db.insert(skillVersions).values({
        skillId: skill[0].id,
        version: '1.0.0',
        systemPromptFragment: data.systemPromptFragment || null,
        workflowRules: data.workflowRules || null,
        documentation: data.documentation,
        changeLog: 'Initial release',
        // R2 storage fields for this version
        storageUrl: data.storageUrl || null,
        packageSize: data.packageSize || null,
        checksum: data.checksum || null,
        // Agent Skills Specification fields
        compatibility: data.compatibility || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      });

      // Step 4: Link categories
      if (categoryRecords.length > 0) {
        await db.insert(skillCategories).values(
          categoryRecords.map((category) => ({
            skillId: skill[0].id,
            categoryId: category.id,
          }))
        );
      }

      // Step 5: Link or create tags
      if (data.tags && data.tags.length > 0) {
        await this.linkTags(skill[0].id, data.tags);
      }

      return skill[0];
    } catch (error) {
      // If we created a skill but something failed, delete it
      if (skillId) {
        try {
          await db.delete(marketplaceSkills).where(eq(marketplaceSkills.id, skillId));
        } catch (deleteError) {
          console.error('Failed to rollback skill creation:', deleteError);
        }
      }
      throw error;
    }
  }

  /**
   * Update skill
   */
  async updateSkill(userId: string, skillId: string, data: UpdateSkillRequest) {
    // Check ownership
    const skill = await this.getSkillById(skillId);
    if (!skill || skill.authorId !== userId) {
      throw new Error('Skill not found or unauthorized');
    }

    const updates: Partial<typeof marketplaceSkills.$inferInsert> = {};

    if (data.name !== undefined) {
      const newSlug = this.generateSlug(data.name);
      // Check if the new slug conflicts with another skill (excluding current skill)
      const existing = await db
        .select()
        .from(marketplaceSkills)
        .where(eq(marketplaceSkills.slug, newSlug))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== skillId) {
        throw new Error('Skill with this name already exists');
      }

      updates.name = data.name;
      updates.slug = newSlug;
    }
    if (data.description !== undefined) updates.description = data.description;
    if (data.longDescription !== undefined) updates.longDescription = data.longDescription;
    if (data.systemPromptFragment !== undefined)
      updates.systemPromptFragment = data.systemPromptFragment;
    if (data.workflowRules !== undefined) updates.workflowRules = data.workflowRules;
    if (data.documentation !== undefined) updates.documentation = data.documentation;
    if (data.iconUrl !== undefined) updates.iconUrl = data.iconUrl;
    if (data.bannerUrl !== undefined) updates.bannerUrl = data.bannerUrl;
    // Agent Skills Specification fields
    if (data.compatibility !== undefined) updates.compatibility = data.compatibility;
    if (data.metadata !== undefined) {
      updates.metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    }

    // Update skill
    if (Object.keys(updates).length > 0) {
      await db.update(marketplaceSkills).set(updates).where(eq(marketplaceSkills.id, skillId));
    }

    // Update categories if provided
    if (data.categories !== undefined) {
      // Remove existing
      await db.delete(skillCategories).where(eq(skillCategories.skillId, skillId));

      // Add new
      if (data.categories.length > 0) {
        const categoryRecords = await db
          .select()
          .from(categories)
          .where(
            sql`${categories.slug} IN (${sql.join(
              data.categories.map((slug: string) => sql`${slug}`),
              sql`, `
            )})`
          );

        if (categoryRecords.length > 0) {
          await db.insert(skillCategories).values(
            categoryRecords.map((category) => ({
              skillId,
              categoryId: category.id,
            }))
          );
        }
      }
    }

    // Update tags if provided
    if (data.tags !== undefined) {
      // Remove existing
      await db.delete(skillTags).where(eq(skillTags.skillId, skillId));

      // Add new
      if (data.tags.length > 0) {
        await this.linkTags(skillId, data.tags);
      }
    }

    return this.getSkillById(skillId);
  }

  /**
   * Publish skill (make it public)
   */
  async publishSkill(userId: string, skillId: string) {
    const skill = await this.getSkillById(skillId);
    if (!skill || skill.authorId !== userId) {
      throw new Error('Skill not found or unauthorized');
    }

    await db
      .update(marketplaceSkills)
      .set({ isPublished: true, publishedAt: Date.now() })
      .where(eq(marketplaceSkills.id, skillId));

    return this.getSkillById(skillId);
  }

  /**
   * Unpublish skill
   */
  async unpublishSkill(userId: string, skillId: string) {
    const skill = await this.getSkillById(skillId);
    if (!skill || skill.authorId !== userId) {
      throw new Error('Skill not found or unauthorized');
    }

    await db
      .update(marketplaceSkills)
      .set({ isPublished: false })
      .where(eq(marketplaceSkills.id, skillId));

    return this.getSkillById(skillId);
  }

  /**
   * Delete skill
   */
  async deleteSkill(userId: string, skillId: string) {
    const skill = await this.getSkillById(skillId);
    if (!skill || skill.authorId !== userId) {
      throw new Error('Skill not found or unauthorized');
    }

    // Delete skill (cascade will handle relations)
    await db.delete(marketplaceSkills).where(eq(marketplaceSkills.id, skillId));

    return true;
  }

  /**
   * Create new version
   */
  async createVersion(
    userId: string,
    skillId: string,
    data: {
      version: string;
      systemPromptFragment?: string;
      workflowRules?: string;
      documentation?: unknown[];
      changeLog: string;
    }
  ) {
    const skill = await this.getSkillById(skillId);
    if (!skill || skill.authorId !== userId) {
      throw new Error('Skill not found or unauthorized');
    }

    // Check if version already exists
    const existingVersion = await db
      .select()
      .from(skillVersions)
      .where(and(eq(skillVersions.skillId, skillId), eq(skillVersions.version, data.version)))
      .limit(1);

    if (existingVersion.length > 0) {
      throw new Error('Version already exists');
    }

    // Create version
    const version = await db
      .insert(skillVersions)
      .values({
        skillId,
        version: data.version,
        systemPromptFragment:
          data.systemPromptFragment !== undefined
            ? data.systemPromptFragment
            : skill.systemPromptFragment,
        workflowRules: data.workflowRules !== undefined ? data.workflowRules : skill.workflowRules,
        documentation: data.documentation !== undefined ? data.documentation : skill.documentation,
        changeLog: data.changeLog,
      })
      .returning();

    // Update latest version
    await db
      .update(marketplaceSkills)
      .set({ latestVersion: data.version })
      .where(eq(marketplaceSkills.id, skillId));

    return version[0];
  }

  /**
   * Get skill by ID (internal)
   */
  private async getSkillById(skillId: string) {
    const results = await db
      .select()
      .from(marketplaceSkills)
      .where(eq(marketplaceSkills.id, skillId))
      .limit(1);

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Link tags to skill (create tags if they don't exist)
   */
  private async linkTags(skillId: string, tagNames: string[]) {
    for (const tagName of tagNames) {
      const tagSlug = this.generateSlug(tagName);

      // Find or create tag
      let tag = await db.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);

      if (tag.length === 0) {
        const newTag = await db
          .insert(tags)
          .values({
            name: tagName,
            slug: tagSlug,
          })
          .returning();

        tag = newTag;
      } else {
        // Increment usage count
        await db
          .update(tags)
          .set({
            usageCount: sql`${tags.usageCount} + 1`,
          })
          .where(eq(tags.id, tag[0].id));
      }

      // Link to skill
      await db.insert(skillTags).values({
        skillId,
        tagId: tag[0].id,
      });
    }
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export const skillService = new SkillService();
