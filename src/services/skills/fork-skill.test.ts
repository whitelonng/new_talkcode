// fork-skill service tests
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Skill } from '@/types/skill';
import type { SkillDatabaseService } from '../database/skill-database-service';
import { forkSkill } from './fork-skill';

// Mock the database service
class MockSkillDatabaseService {
  private skills: Map<string, Skill> = new Map();

  async getSkill(id: string): Promise<Skill | null> {
    return this.skills.get(id) || null;
  }

  async createSkill(skill: Skill): Promise<void> {
    this.skills.set(skill.id, skill);
  }

  async listSkills(): Promise<Skill[]> {
    return Array.from(this.skills.values());
  }

  async clear(): Promise<void> {
    this.skills.clear();
  }

  // Helper for testing
  addTestSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }
}

describe('forkSkill', () => {
  let dbService: MockSkillDatabaseService;

  beforeEach(() => {
    dbService = new MockSkillDatabaseService();
  });

  afterEach(async () => {
    await dbService.clear();
  });

  it('should fork a local custom skill successfully', async () => {
    const sourceSkill: Skill = {
      id: 'source-skill-1',
      name: 'Original Skill',
      description: 'Original description',
      category: 'Development',
      content: {
        systemPromptFragment: 'You are helpful',
        workflowRules: 'Follow best practices',
        documentation: [
          {
            type: 'inline',
            title: 'Guide',
            content: 'How to use this skill',
          },
        ],
      },
      metadata: {
        isBuiltIn: false,
        sourceType: 'local',
        tags: ['test', 'original'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    dbService.addTestSkill(sourceSkill);

    const newSkillId = await forkSkill('source-skill-1', dbService as any as SkillDatabaseService);

    expect(newSkillId).toBeTruthy();
    expect(newSkillId).not.toBe('source-skill-1');

    const forkedSkill = await dbService.getSkill(newSkillId!);
    expect(forkedSkill).toBeTruthy();
    expect(forkedSkill?.name).toBe('Original Skill (Fork)');
    expect(forkedSkill?.description).toBe(sourceSkill.description);
    expect(forkedSkill?.content.systemPromptFragment).toBe(
      sourceSkill.content.systemPromptFragment
    );
    expect(forkedSkill?.metadata.sourceType).toBe('local');
    expect(forkedSkill?.metadata.forkedFromId).toBe('source-skill-1');
    expect(forkedSkill?.metadata.isShared).toBe(false);
  });

  it('should fork a marketplace skill successfully', async () => {
    const marketplaceSkill: Skill = {
      id: 'local-copy-1',
      name: 'Marketplace Skill',
      description: 'Downloaded from marketplace',
      category: 'Productivity',
      content: {
        systemPromptFragment: 'Be productive',
      },
      marketplace: {
        marketplaceId: 'marketplace-123',
        version: '1.0.0',
        author: 'John Doe',
        authorId: 'author-123',
        downloads: 1000,
        rating: 4.5,
      },
      metadata: {
        isBuiltIn: false,
        sourceType: 'marketplace',
        tags: ['productivity'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    dbService.addTestSkill(marketplaceSkill);

    const newSkillId = await forkSkill('local-copy-1', dbService as any as SkillDatabaseService);

    expect(newSkillId).toBeTruthy();

    const forkedSkill = await dbService.getSkill(newSkillId!);
    expect(forkedSkill?.metadata.forkedFromMarketplaceId).toBe('marketplace-123');
    expect(forkedSkill?.metadata.forkedFromId).toBeUndefined();
    expect(forkedSkill?.metadata.sourceType).toBe('local');
  });

  it('should handle multiple forks with incremental naming', async () => {
    const sourceSkill: Skill = {
      id: 'source-skill-2',
      name: 'Popular Skill',
      description: 'A popular skill',
      category: 'General',
      content: {},
      metadata: {
        isBuiltIn: false,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    dbService.addTestSkill(sourceSkill);

    // Fork multiple times
    const fork1Id = await forkSkill('source-skill-2', dbService as any as SkillDatabaseService);
    const fork2Id = await forkSkill('source-skill-2', dbService as any as SkillDatabaseService);
    const fork3Id = await forkSkill('source-skill-2', dbService as any as SkillDatabaseService);

    const fork1 = await dbService.getSkill(fork1Id!);
    const fork2 = await dbService.getSkill(fork2Id!);
    const fork3 = await dbService.getSkill(fork3Id!);

    expect(fork1?.name).toBe('Popular Skill (Fork)');
    expect(fork2?.name).toBe('Popular Skill (Fork 2)');
    expect(fork3?.name).toBe('Popular Skill (Fork 3)');
  });

  it('should preserve skill content when forking', async () => {
    const sourceSkill: Skill = {
      id: 'source-skill-3',
      name: 'Content Rich Skill',
      description: 'Has lots of content',
      longDescription: 'Detailed description here',
      category: 'Advanced',
      icon: 'https://example.com/icon.png',
      content: {
        systemPromptFragment: 'Complex prompt',
        workflowRules: 'Detailed workflow',
        documentation: [
          {
            type: 'inline',
            title: 'Chapter 1',
            content: 'Content 1',
          },
          {
            type: 'url',
            title: 'External Doc',
            url: 'https://example.com/doc',
          },
        ],
      },
      metadata: {
        isBuiltIn: false,
        tags: ['tag1', 'tag2', 'tag3'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    dbService.addTestSkill(sourceSkill);

    const newSkillId = await forkSkill('source-skill-3', dbService as any as SkillDatabaseService);

    const forkedSkill = await dbService.getSkill(newSkillId!);

    expect(forkedSkill?.description).toBe(sourceSkill.description);
    expect(forkedSkill?.longDescription).toBe(sourceSkill.longDescription);
    expect(forkedSkill?.category).toBe(sourceSkill.category);
    expect(forkedSkill?.icon).toBe(sourceSkill.icon);
    expect(forkedSkill?.content.systemPromptFragment).toBe(
      sourceSkill.content.systemPromptFragment
    );
    expect(forkedSkill?.content.workflowRules).toBe(sourceSkill.content.workflowRules);
    expect(forkedSkill?.content.documentation).toHaveLength(2);
    expect(forkedSkill?.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should return null when source skill does not exist', async () => {
    const result = await forkSkill('non-existent-skill', dbService as any as SkillDatabaseService);

    expect(result).toBeNull();
  });

  it('should not fork built-in skills as built-in', async () => {
    const builtInSkill: Skill = {
      id: 'builtin-skill-1',
      name: 'System Skill',
      description: 'Built-in system skill',
      category: 'System',
      content: {},
      metadata: {
        isBuiltIn: true,
        sourceType: 'system',
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    dbService.addTestSkill(builtInSkill);

    const newSkillId = await forkSkill('builtin-skill-1', dbService as any as SkillDatabaseService);

    const forkedSkill = await dbService.getSkill(newSkillId!);

    expect(forkedSkill?.metadata.isBuiltIn).toBe(false);
    expect(forkedSkill?.metadata.sourceType).toBe('local');
  });

  it('should create deep copy of documentation array', async () => {
    const sourceSkill: Skill = {
      id: 'source-skill-4',
      name: 'Doc Test Skill',
      description: 'Test documentation copying',
      category: 'Test',
      content: {
        documentation: [
          {
            type: 'inline',
            title: 'Original',
            content: 'Original content',
          },
        ],
      },
      metadata: {
        isBuiltIn: false,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    dbService.addTestSkill(sourceSkill);

    const newSkillId = await forkSkill('source-skill-4', dbService as any as SkillDatabaseService);

    const forkedSkill = await dbService.getSkill(newSkillId!);

    // Verify it's a deep copy, not a reference
    expect(forkedSkill?.content.documentation).not.toBe(sourceSkill.content.documentation);
    expect(forkedSkill?.content.documentation?.[0]).not.toBe(
      sourceSkill.content.documentation?.[0]
    );

    // But values should be equal
    expect(forkedSkill?.content.documentation?.[0]).toEqual(sourceSkill.content.documentation?.[0]);
  });

  it('should handle skills without optional fields', async () => {
    const minimalSkill: Skill = {
      id: 'minimal-skill',
      name: 'Minimal Skill',
      description: 'Minimal description',
      category: 'General',
      content: {}, // No content
      metadata: {
        isBuiltIn: false,
        tags: [], // No tags
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    dbService.addTestSkill(minimalSkill);

    const newSkillId = await forkSkill('minimal-skill', dbService as any as SkillDatabaseService);

    const forkedSkill = await dbService.getSkill(newSkillId!);

    expect(forkedSkill).toBeTruthy();
    expect(forkedSkill?.name).toBe('Minimal Skill (Fork)');
    expect(forkedSkill?.content).toBeDefined();
    expect(forkedSkill?.metadata.tags).toEqual([]);
  });
});
