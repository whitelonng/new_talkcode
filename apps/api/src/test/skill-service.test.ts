// SkillService unit tests
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
  categories,
  marketplaceSkills,
  skillCategories,
  skillTags,
  skillVersions,
  tags,
  users,
} from '../db/schema';
import { skillService } from '../services/skill-service';
import { clearDatabase, seedTestDatabase } from './fixtures';

let testUserId: string;
let testCategoryId: string;

beforeAll(async () => {
  console.log('\n🔧 Setting up SkillService tests...\n');

  const _testData = await seedTestDatabase();

  // Get a test user
  const usersResult = await db.select().from(users).limit(1);
  if (usersResult.length === 0) {
    throw new Error('No test users found');
  }
  testUserId = usersResult[0].id;

  // Get a test category
  const categoriesResult = await db.select().from(categories).limit(1);
  if (categoriesResult.length === 0) {
    throw new Error('No test categories found');
  }
  testCategoryId = categoriesResult[0].slug;

  console.log('✅ SkillService test setup complete\n');
});

afterAll(async () => {
  console.log('\n🧹 Cleaning up SkillService tests...\n');
  await clearDatabase();
  console.log('✅ Cleanup complete\n');
});

describe('SkillService - Create Skill', () => {
  it('should create a skill successfully', async () => {
    const skillData = {
      name: `Test Skill ${Date.now()}`,
      description: 'A test skill for unit testing',
      longDescription: 'This is a detailed description of the test skill',
      systemPromptFragment: 'You are a test assistant',
      workflowRules: 'Follow test workflow',
      documentation: [
        {
          type: 'inline' as const,
          title: 'Getting Started',
          content: 'This is how to use the test skill',
        },
      ],
      iconUrl: 'https://example.com/icon.png',
      categories: [testCategoryId],
      tags: ['test', 'unit-test', 'automation'],
    };

    const skill = await skillService.createSkill(testUserId, skillData);

    expect(skill).toBeDefined();
    expect(skill.id).toBeDefined();
    expect(skill.name).toBe(skillData.name);
    expect(skill.description).toBe(skillData.description);
    expect(skill.systemPromptFragment).toBe(skillData.systemPromptFragment);
    expect(skill.workflowRules).toBe(skillData.workflowRules);
    expect(skill.latestVersion).toBe('1.0.0');
    expect(skill.isPublished).toBe(false);
    expect(skill.authorId).toBe(testUserId);

    // Verify initial version was created
    const versions = await db
      .select()
      .from(skillVersions)
      .where(eq(skillVersions.skillId, skill.id));

    expect(versions.length).toBe(1);
    expect(versions[0].version).toBe('1.0.0');
    expect(versions[0].changeLog).toBe('Initial release');

    // Verify categories were linked
    const linkedCategories = await db
      .select()
      .from(skillCategories)
      .where(eq(skillCategories.skillId, skill.id));

    expect(linkedCategories.length).toBeGreaterThan(0);

    // Verify tags were created and linked
    const linkedTags = await db.select().from(skillTags).where(eq(skillTags.skillId, skill.id));

    expect(linkedTags.length).toBe(3);
  });

  it('should fail when creating skill with duplicate name', async () => {
    const skillData = {
      name: `Duplicate Skill ${Date.now()}`,
      description: 'First skill',
      documentation: [],
      categories: [testCategoryId],
      tags: [],
    };

    // Create first skill
    await skillService.createSkill(testUserId, skillData);

    // Try to create duplicate - should fail
    try {
      await skillService.createSkill(testUserId, skillData);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('already exists');
    }
  });

  it('should fail when creating skill without valid categories', async () => {
    const skillData = {
      name: `No Category Skill ${Date.now()}`,
      description: 'Skill without categories',
      documentation: [],
      categories: ['non-existent-category'],
      tags: [],
    };

    try {
      await skillService.createSkill(testUserId, skillData);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('No valid categories');
    }
  });
});

describe('SkillService - Update Skill', () => {
  let testSkillId: string;

  beforeEach(async () => {
    // Create a test skill
    const skillData = {
      name: `Skill to Update ${Date.now()}`,
      description: 'Original description',
      documentation: [],
      categories: [testCategoryId],
      tags: ['original'],
    };
    const skill = await skillService.createSkill(testUserId, skillData);
    testSkillId = skill.id;
  });

  afterEach(async () => {
    // Clean up the test skill
    if (testSkillId) {
      try {
        await skillService.deleteSkill(testUserId, testSkillId);
      } catch (_e) {
        // Ignore errors if already deleted
      }
    }
  });

  it('should update skill successfully', async () => {
    const updates = {
      name: `Updated Skill Name ${Date.now()}`,
      description: 'Updated description',
      systemPromptFragment: 'Updated prompt',
      tags: ['updated', 'modified'],
    };

    const updatedSkill = await skillService.updateSkill(testUserId, testSkillId, updates);

    expect(updatedSkill).toBeDefined();
    expect(updatedSkill?.name).toBe(updates.name);
    expect(updatedSkill?.description).toBe(updates.description);
    expect(updatedSkill?.systemPromptFragment).toBe(updates.systemPromptFragment);
  });

  it('should fail to update non-existent skill', async () => {
    try {
      await skillService.updateSkill(testUserId, 'non-existent-id', {
        name: 'New Name',
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('not found');
    }
  });

  it('should fail to update skill without ownership', async () => {
    const otherUserId = 'different-user-id';

    try {
      await skillService.updateSkill(otherUserId, testSkillId, {
        name: 'New Name',
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('unauthorized');
    }
  });
});

describe('SkillService - Publish/Unpublish Skill', () => {
  let testSkillId: string;

  beforeEach(async () => {
    const skillData = {
      name: `Skill to Publish ${Date.now()}`,
      description: 'Test publishing',
      documentation: [],
      categories: [testCategoryId],
      tags: [],
    };
    const skill = await skillService.createSkill(testUserId, skillData);
    testSkillId = skill.id;
  });

  afterEach(async () => {
    // Clean up the test skill
    if (testSkillId) {
      try {
        await skillService.deleteSkill(testUserId, testSkillId);
      } catch (_e) {
        // Ignore errors if already deleted
      }
    }
  });

  it('should publish skill successfully', async () => {
    const publishedSkill = await skillService.publishSkill(testUserId, testSkillId);

    expect(publishedSkill).toBeDefined();
    expect(publishedSkill?.isPublished).toBe(true);
    expect(publishedSkill?.publishedAt).toBeDefined();
    expect(publishedSkill?.publishedAt).toBeGreaterThan(0);
  });

  it('should unpublish skill successfully', async () => {
    // First publish
    await skillService.publishSkill(testUserId, testSkillId);

    // Then unpublish
    const unpublishedSkill = await skillService.unpublishSkill(testUserId, testSkillId);

    expect(unpublishedSkill).toBeDefined();
    expect(unpublishedSkill?.isPublished).toBe(false);
  });

  it('should fail to publish non-existent skill', async () => {
    try {
      await skillService.publishSkill(testUserId, 'non-existent-id');
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('not found');
    }
  });
});

describe('SkillService - Delete Skill', () => {
  it('should delete skill successfully', async () => {
    const skillData = {
      name: `Skill to Delete ${Date.now()}`,
      description: 'Will be deleted',
      documentation: [],
      categories: [testCategoryId],
      tags: ['deletable'],
    };
    const skill = await skillService.createSkill(testUserId, skillData);

    const result = await skillService.deleteSkill(testUserId, skill.id);
    expect(result).toBe(true);

    // Verify skill is deleted
    const deletedSkill = await db
      .select()
      .from(marketplaceSkills)
      .where(eq(marketplaceSkills.id, skill.id))
      .limit(1);

    expect(deletedSkill.length).toBe(0);
  });

  it('should fail to delete non-existent skill', async () => {
    try {
      await skillService.deleteSkill(testUserId, 'non-existent-id');
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('not found');
    }
  });
});

describe('SkillService - Create Version', () => {
  let testSkillId: string;

  beforeEach(async () => {
    const skillData = {
      name: `Versioned Skill ${Date.now()}`,
      description: 'Test versioning',
      documentation: [],
      categories: [testCategoryId],
      tags: [],
    };
    const skill = await skillService.createSkill(testUserId, skillData);
    testSkillId = skill.id;
  });

  afterEach(async () => {
    // Clean up the test skill
    if (testSkillId) {
      try {
        await skillService.deleteSkill(testUserId, testSkillId);
      } catch (_e) {
        // Ignore errors if already deleted
      }
    }
  });

  it('should create new version successfully', async () => {
    const versionData = {
      version: '1.1.0',
      systemPromptFragment: 'Updated prompt for v1.1',
      changeLog: 'Added new features',
    };

    const version = await skillService.createVersion(testUserId, testSkillId, versionData);

    expect(version).toBeDefined();
    expect(version.version).toBe('1.1.0');
    expect(version.systemPromptFragment).toBe(versionData.systemPromptFragment);
    expect(version.changeLog).toBe(versionData.changeLog);

    // Verify latest version was updated
    const skill = await db
      .select()
      .from(marketplaceSkills)
      .where(eq(marketplaceSkills.id, testSkillId))
      .limit(1);

    expect(skill[0].latestVersion).toBe('1.1.0');
  });

  it('should fail to create duplicate version', async () => {
    const versionData = {
      version: '1.0.0', // Already exists from initial creation
      changeLog: 'Duplicate version',
    };

    try {
      await skillService.createVersion(testUserId, testSkillId, versionData);
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('already exists');
    }
  });
});

describe('SkillService - Tag Management', () => {
  it('should create new tags when they do not exist', async () => {
    const skillData = {
      name: `Skill with New Tags ${Date.now()}`,
      description: 'Testing tag creation',
      documentation: [],
      categories: [testCategoryId],
      tags: [`brand-new-tag-${Date.now()}`, `another-new-tag-${Date.now()}`],
    };

    const _skill = await skillService.createSkill(testUserId, skillData);

    // Verify tags were created
    for (const tagName of skillData.tags) {
      const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-');
      const foundTag = await db.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);

      expect(foundTag.length).toBe(1);
      expect(foundTag[0].name).toBe(tagName);
    }
  });

  it('should increment usage count for existing tags', async () => {
    const tagName = `reusable-tag-${Date.now()}`;
    const timestamp = Date.now();

    // Create first skill with tag
    const skill1Data = {
      name: `First Skill ${timestamp}`,
      description: 'First skill',
      documentation: [],
      categories: [testCategoryId],
      tags: [tagName],
    };
    await skillService.createSkill(testUserId, skill1Data);

    const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-');
    const tag1 = await db.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);
    const initialCount = tag1[0].usageCount;

    // Create second skill with same tag
    const skill2Data = {
      name: `Second Skill ${timestamp}`,
      description: 'Second skill',
      documentation: [],
      categories: [testCategoryId],
      tags: [tagName],
    };
    await skillService.createSkill(testUserId, skill2Data);

    const tag2 = await db.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);
    expect(tag2[0].usageCount).toBe(initialCount + 1);
  });
});

describe('SkillService - Slug Generation', () => {
  it('should generate valid slugs from skill names', async () => {
    const testCases = [
      { name: 'My Awesome Skill', expectedSlug: 'my-awesome-skill' },
      { name: 'Skill with CAPS', expectedSlug: 'skill-with-caps' },
      { name: 'Skill!!!???', expectedSlug: 'skill' },
      { name: '  Spaced  Out  ', expectedSlug: 'spaced-out' },
    ];

    for (const testCase of testCases) {
      const skillData = {
        name: testCase.name,
        description: 'Test slug generation',
        documentation: [],
        categories: [testCategoryId],
        tags: [],
      };

      const skill = await skillService.createSkill(testUserId, skillData);
      expect(skill.slug).toBe(testCase.expectedSlug);

      // Clean up
      await skillService.deleteSkill(testUserId, skill.id);
    }
  });
});
