// Agent management service for CRUD operations

import type { CreateAgentRequest, UpdateAgentRequest } from '@talkcody/shared';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  agentCategories,
  agentTags,
  agentVersions,
  categories,
  marketplaceAgents,
  tags,
} from '../db/schema';
import type { DynamicPromptConfig, ToolsConfig } from '../types/database';

export class AgentService {
  /**
   * Create a new agent (publish to marketplace)
   */
  async createAgent(userId: string, data: CreateAgentRequest) {
    // Generate slug from name
    const slug = this.generateSlug(data.name);

    // Check if slug already exists
    const existing = await db
      .select()
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Agent with this name already exists');
    }

    let agentId: string | null = null;

    try {
      // Step 1: Validate and get category UUIDs first (before creating anything)
      let categoryRecords: Array<{ id: string; slug: string; name: string }> = [];
      if (data.categoryIds && data.categoryIds.length > 0) {
        categoryRecords = await db
          .select()
          .from(categories)
          .where(
            sql`${categories.slug} IN (${sql.join(
              data.categoryIds.map((id: string) => sql`${id}`),
              sql`, `
            )})`
          );

        if (categoryRecords.length === 0) {
          throw new Error('No valid categories found');
        }
      }

      // Step 2: Create agent
      const agent = await db
        .insert(marketplaceAgents)
        .values({
          slug,
          name: data.name,
          description: data.description,
          authorId: userId,
          model: data.model,
          systemPrompt: data.systemPrompt,
          toolsConfig: data.toolsConfig || {},
          rules: data.rules || null,
          outputFormat: data.outputFormat || null,
          dynamicPromptConfig: data.dynamicPromptConfig || null,
          latestVersion: '1.0.0',
          iconUrl: data.iconUrl || null,
          isPublished: false, // Draft by default
        })
        .returning();

      agentId = agent[0].id;

      // Step 3: Create initial version
      await db.insert(agentVersions).values({
        agentId: agent[0].id,
        version: '1.0.0',
        systemPrompt: data.systemPrompt,
        toolsConfig: data.toolsConfig || {},
        rules: data.rules || null,
        outputFormat: data.outputFormat || null,
        dynamicPromptConfig: data.dynamicPromptConfig || null,
        changeLog: 'Initial release',
      });

      // Step 4: Link categories
      if (categoryRecords.length > 0) {
        await db.insert(agentCategories).values(
          categoryRecords.map((category) => ({
            agentId: agent[0].id,
            categoryId: category.id,
          }))
        );
      }

      // Step 5: Link or create tags
      if (data.tags && data.tags.length > 0) {
        await this.linkTags(agent[0].id, data.tags);
      }

      return agent[0];
    } catch (error) {
      // If we created an agent but something failed, delete it
      if (agentId) {
        try {
          await db.delete(marketplaceAgents).where(eq(marketplaceAgents.id, agentId));
        } catch (deleteError) {
          console.error('Failed to rollback agent creation:', deleteError);
        }
      }
      throw error;
    }
  }

  /**
   * Update agent
   */
  async updateAgent(userId: string, agentId: string, data: UpdateAgentRequest) {
    // Check ownership
    const agent = await this.getAgentById(agentId);
    if (!agent || agent.authorId !== userId) {
      throw new Error('Agent not found or unauthorized');
    }

    const updates: Partial<{
      name: string;
      slug: string;
      description: string;
      longDescription: string;
      model: string;
      systemPrompt: string;
      toolsConfig: ToolsConfig;
      rules: string | null;
      outputFormat: string | null;
      dynamicPromptConfig: DynamicPromptConfig | null;
      iconUrl: string;
      bannerUrl: string;
    }> = {};

    if (data.name !== undefined) {
      updates.name = data.name;
      updates.slug = this.generateSlug(data.name);
    }
    if (data.description !== undefined) updates.description = data.description;
    if (data.model !== undefined) updates.model = data.model;
    if (data.systemPrompt !== undefined) updates.systemPrompt = data.systemPrompt;
    if (data.toolsConfig !== undefined) updates.toolsConfig = data.toolsConfig;
    if (data.rules !== undefined) updates.rules = data.rules;
    if (data.outputFormat !== undefined) updates.outputFormat = data.outputFormat;
    if (data.dynamicPromptConfig !== undefined) {
      updates.dynamicPromptConfig = data.dynamicPromptConfig;
    }
    if (data.iconUrl !== undefined) updates.iconUrl = data.iconUrl;

    // Update agent
    if (Object.keys(updates).length > 0) {
      await db.update(marketplaceAgents).set(updates).where(eq(marketplaceAgents.id, agentId));
    }

    // Update categories if provided
    if (data.categoryIds !== undefined) {
      // Remove existing
      await db.delete(agentCategories).where(eq(agentCategories.agentId, agentId));

      // Add new
      if (data.categoryIds.length > 0) {
        await db.insert(agentCategories).values(
          data.categoryIds.map((categoryId: string) => ({
            agentId,
            categoryId,
          }))
        );
      }
    }

    // Update tags if provided
    if (data.tags !== undefined) {
      // Remove existing
      await db.delete(agentTags).where(eq(agentTags.agentId, agentId));

      // Add new
      if (data.tags.length > 0) {
        await this.linkTags(agentId, data.tags);
      }
    }

    return this.getAgentById(agentId);
  }

  /**
   * Publish agent (make it public)
   */
  async publishAgent(userId: string, agentId: string) {
    const agent = await this.getAgentById(agentId);
    if (!agent || agent.authorId !== userId) {
      throw new Error('Agent not found or unauthorized');
    }

    await db
      .update(marketplaceAgents)
      .set({ isPublished: true, publishedAt: Date.now() })
      .where(eq(marketplaceAgents.id, agentId));

    return this.getAgentById(agentId);
  }

  /**
   * Unpublish agent
   */
  async unpublishAgent(userId: string, agentId: string) {
    const agent = await this.getAgentById(agentId);
    if (!agent || agent.authorId !== userId) {
      throw new Error('Agent not found or unauthorized');
    }

    await db
      .update(marketplaceAgents)
      .set({ isPublished: false })
      .where(eq(marketplaceAgents.id, agentId));

    return this.getAgentById(agentId);
  }

  /**
   * Delete agent
   */
  async deleteAgent(userId: string, agentId: string) {
    const agent = await this.getAgentById(agentId);
    if (!agent || agent.authorId !== userId) {
      throw new Error('Agent not found or unauthorized');
    }

    // Delete agent (cascade will handle relations)
    await db.delete(marketplaceAgents).where(eq(marketplaceAgents.id, agentId));

    return true;
  }

  /**
   * Create new version
   */
  async createVersion(
    userId: string,
    agentId: string,
    data: {
      version: string;
      systemPrompt?: string;
      toolsConfig?: ToolsConfig;
      rules?: string;
      outputFormat?: string;
      dynamicPromptConfig?: DynamicPromptConfig;
      changeLog: string;
    }
  ) {
    const agent = await this.getAgentById(agentId);
    if (!agent || agent.authorId !== userId) {
      throw new Error('Agent not found or unauthorized');
    }

    // Check if version already exists
    const existingVersion = await db
      .select()
      .from(agentVersions)
      .where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.version, data.version)))
      .limit(1);

    if (existingVersion.length > 0) {
      throw new Error('Version already exists');
    }

    // Create version
    const version = await db
      .insert(agentVersions)
      .values({
        agentId,
        version: data.version,
        systemPrompt: data.systemPrompt || agent.systemPrompt,
        toolsConfig: data.toolsConfig || agent.toolsConfig,
        rules: data.rules !== undefined ? data.rules : agent.rules,
        outputFormat: data.outputFormat !== undefined ? data.outputFormat : agent.outputFormat,
        dynamicPromptConfig:
          data.dynamicPromptConfig !== undefined
            ? data.dynamicPromptConfig
            : agent.dynamicPromptConfig,
        changeLog: data.changeLog,
      })
      .returning();

    // Update latest version
    await db
      .update(marketplaceAgents)
      .set({ latestVersion: data.version })
      .where(eq(marketplaceAgents.id, agentId));

    return version[0];
  }

  /**
   * Get agent by ID (internal)
   */
  private async getAgentById(agentId: string) {
    const results = await db
      .select()
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.id, agentId))
      .limit(1);

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Link tags to agent (create tags if they don't exist)
   */
  private async linkTags(agentId: string, tagNames: string[]) {
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

      // Link to agent
      await db.insert(agentTags).values({
        agentId,
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

export const agentService = new AgentService();
