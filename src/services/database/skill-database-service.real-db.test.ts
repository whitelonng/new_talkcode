/**
 * SkillDatabaseService Tests with Real Database
 *
 * Tests SkillDatabaseService with real SQLite database operations
 * instead of mocks, providing more reliable integration testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkillDatabaseService } from './skill-database-service';
import { TestDatabaseAdapter } from '@/test/infrastructure/adapters/test-database-adapter';
import type { Skill } from '@/types/skill';
import { mockLogger } from '@/test/mocks';

vi.mock('@/lib/logger', () => mockLogger);

const createTestSkill = (overrides: Partial<Skill> = {}): Skill => ({
  id: `skill-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: 'Test Skill',
  description: 'A test skill',
  category: 'testing',
  content: {
    systemPromptFragment: 'Test system prompt',
    documentation: [],
  },
  metadata: {
    isBuiltIn: false,
    tags: ['test'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourceType: 'local',
  },
  ...overrides,
});

describe('SkillDatabaseService with Real Database', () => {
  let db: TestDatabaseAdapter;
  let skillService: SkillDatabaseService;

  beforeEach(() => {
    db = new TestDatabaseAdapter({ enableLogging: false });
    skillService = new SkillDatabaseService(db.getTursoClientAdapter());
  });

  afterEach(() => {
    db.close();
  });

  describe('createSkill', () => {
    it('should create a skill and persist to database', async () => {
      const skill = createTestSkill({ id: 'skill-create-test' });

      await skillService.createSkill(skill);

      const rows = db.rawQuery<{ id: string; name: string }>(
        'SELECT id, name FROM skills WHERE id = ?',
        [skill.id]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('skill-create-test');
      expect(rows[0]?.name).toBe('Test Skill');
    });

    it('should store all skill properties', async () => {
      const skill = createTestSkill({
        id: 'skill-full-props',
        name: 'Full Props Skill',
        description: 'Description here',
        longDescription: 'Long description here',
        category: 'custom',
        icon: 'https://example.com/icon.png',
        content: {
          systemPromptFragment: 'System prompt',
          workflowRules: 'Workflow rules',
          documentation: [{ title: 'Doc', content: 'Content' }],
        },
        metadata: {
          isBuiltIn: true,
          tags: ['tag1', 'tag2'],
          createdAt: 1000,
          updatedAt: 2000,
        },
      });

      await skillService.createSkill(skill);

      const rows = db.rawQuery<{
        id: string;
        name: string;
        description: string;
        long_description: string;
        category: string;
        icon_url: string;
        system_prompt_fragment: string;
        workflow_rules: string;
        documentation: string;
        is_built_in: number;
        tags: string;
      }>('SELECT * FROM skills WHERE id = ?', [skill.id]);

      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe('Full Props Skill');
      expect(rows[0]?.description).toBe('Description here');
      expect(rows[0]?.long_description).toBe('Long description here');
      expect(rows[0]?.category).toBe('custom');
      expect(rows[0]?.icon_url).toBe('https://example.com/icon.png');
      expect(rows[0]?.system_prompt_fragment).toBe('System prompt');
      expect(rows[0]?.workflow_rules).toBe('Workflow rules');
      expect(JSON.parse(rows[0]?.documentation || '[]')).toEqual([
        { title: 'Doc', content: 'Content' },
      ]);
      expect(rows[0]?.is_built_in).toBe(1);
      expect(JSON.parse(rows[0]?.tags || '[]')).toEqual(['tag1', 'tag2']);
    });

    it('should store marketplace metadata', async () => {
      const skill = createTestSkill({
        id: 'skill-marketplace',
        marketplace: {
          marketplaceId: 'mp-123',
          version: '1.0.0',
          author: 'Test Author',
          authorId: 'author-1',
          downloads: 100,
          rating: 4.5,
        },
      });

      await skillService.createSkill(skill);

      const rows = db.rawQuery<{
        marketplace_id: string;
        marketplace_version: string;
        author_name: string;
        downloads: number;
        rating: number;
      }>('SELECT marketplace_id, marketplace_version, author_name, downloads, rating FROM skills WHERE id = ?', [skill.id]);

      expect(rows[0]?.marketplace_id).toBe('mp-123');
      expect(rows[0]?.marketplace_version).toBe('1.0.0');
      expect(rows[0]?.author_name).toBe('Test Author');
      expect(rows[0]?.downloads).toBe(100);
      expect(rows[0]?.rating).toBe(4.5);
    });
  });

  describe('getSkill', () => {
    it('should return a skill by ID', async () => {
      const skill = createTestSkill({ id: 'skill-get-test', name: 'Get Test Skill' });
      await skillService.createSkill(skill);

      const result = await skillService.getSkill('skill-get-test');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('skill-get-test');
      expect(result?.name).toBe('Get Test Skill');
      expect(result?.category).toBe('testing');
    });

    it('should return null for non-existent skill', async () => {
      const result = await skillService.getSkill('non-existent');

      expect(result).toBeNull();
    });

    it('should correctly parse JSON fields', async () => {
      const skill = createTestSkill({
        id: 'skill-json-parse',
        content: {
          systemPromptFragment: 'Prompt',
          documentation: [{ title: 'Test', content: 'Content' }],
        },
        metadata: {
          isBuiltIn: false,
          tags: ['a', 'b', 'c'],
          createdAt: 1000,
          updatedAt: 2000,
          sourceType: 'local',
        },
      });
      await skillService.createSkill(skill);

      const result = await skillService.getSkill('skill-json-parse');

      expect(result?.content.documentation).toEqual([{ title: 'Test', content: 'Content' }]);
      expect(result?.metadata.tags).toEqual(['a', 'b', 'c']);
    });
  });

  describe('updateSkill', () => {
    it('should update skill name', async () => {
      const skill = createTestSkill({ id: 'skill-update-name' });
      await skillService.createSkill(skill);

      await skillService.updateSkill('skill-update-name', { name: 'Updated Name' });

      const result = await skillService.getSkill('skill-update-name');
      expect(result?.name).toBe('Updated Name');
    });

    it('should update skill description', async () => {
      const skill = createTestSkill({ id: 'skill-update-desc' });
      await skillService.createSkill(skill);

      await skillService.updateSkill('skill-update-desc', { description: 'New description' });

      const result = await skillService.getSkill('skill-update-desc');
      expect(result?.description).toBe('New description');
    });

    it('should update skill content', async () => {
      const skill = createTestSkill({ id: 'skill-update-content' });
      await skillService.createSkill(skill);

      await skillService.updateSkill('skill-update-content', {
        content: {
          systemPromptFragment: 'New prompt',
          workflowRules: 'New rules',
          documentation: [{ title: 'New Doc', content: 'New Content' }],
        },
      });

      const result = await skillService.getSkill('skill-update-content');
      expect(result?.content.systemPromptFragment).toBe('New prompt');
      expect(result?.content.workflowRules).toBe('New rules');
      expect(result?.content.documentation).toEqual([{ title: 'New Doc', content: 'New Content' }]);
    });

    it('should update tags', async () => {
      const skill = createTestSkill({ id: 'skill-update-tags' });
      await skillService.createSkill(skill);

      await skillService.updateSkill('skill-update-tags', {
        metadata: { tags: ['new', 'tags'], isBuiltIn: false, createdAt: 0, updatedAt: 0, sourceType: 'local' },
      });

      const result = await skillService.getSkill('skill-update-tags');
      expect(result?.metadata.tags).toEqual(['new', 'tags']);
    });

    it('should update updated_at timestamp', async () => {
      const skill = createTestSkill({ id: 'skill-update-time' });
      await skillService.createSkill(skill);

      const before = db.rawQuery<{ updated_at: number }>(
        'SELECT updated_at FROM skills WHERE id = ?',
        ['skill-update-time']
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      await skillService.updateSkill('skill-update-time', { name: 'Updated' });

      const after = db.rawQuery<{ updated_at: number }>(
        'SELECT updated_at FROM skills WHERE id = ?',
        ['skill-update-time']
      );

      expect(after[0]?.updated_at).toBeGreaterThan(before[0]?.updated_at ?? 0);
    });

    it('should throw error for non-existent skill', async () => {
      await expect(
        skillService.updateSkill('non-existent', { name: 'New' })
      ).rejects.toThrow('Skill non-existent not found');
    });
  });

  describe('deleteSkill', () => {
    it('should delete a skill', async () => {
      const skill = createTestSkill({ id: 'skill-delete-test' });
      await skillService.createSkill(skill);

      // Verify it exists
      let result = await skillService.getSkill('skill-delete-test');
      expect(result).not.toBeNull();

      await skillService.deleteSkill('skill-delete-test');

      // Verify it's deleted
      result = await skillService.getSkill('skill-delete-test');
      expect(result).toBeNull();
    });
  });

  describe('listSkills', () => {
    beforeEach(async () => {
      // Create test skills
      await skillService.createSkill(createTestSkill({
        id: 'skill-list-1',
        name: 'Alpha Skill',
        category: 'cat-a',
        metadata: { isBuiltIn: true, tags: ['tag1'], createdAt: 1000, updatedAt: 1000, sourceType: 'local' },
      }));
      await skillService.createSkill(createTestSkill({
        id: 'skill-list-2',
        name: 'Beta Skill',
        category: 'cat-b',
        metadata: { isBuiltIn: false, tags: ['tag2'], createdAt: 2000, updatedAt: 2000, sourceType: 'local' },
      }));
      await skillService.createSkill(createTestSkill({
        id: 'skill-list-3',
        name: 'Gamma Skill',
        category: 'cat-a',
        metadata: { isBuiltIn: false, tags: ['tag1', 'tag2'], createdAt: 3000, updatedAt: 3000, sourceType: 'local' },
      }));
    });

    it('should return all skills', async () => {
      const skills = await skillService.listSkills();

      expect(skills.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by category', async () => {
      const skills = await skillService.listSkills({ category: 'cat-a' });

      expect(skills).toHaveLength(2);
      expect(skills.every((s) => s.category === 'cat-a')).toBe(true);
    });

    it('should filter by isBuiltIn', async () => {
      const builtInSkills = await skillService.listSkills({ isBuiltIn: true });

      expect(builtInSkills.every((s) => s.metadata.isBuiltIn)).toBe(true);
    });

    it('should filter by search term', async () => {
      const skills = await skillService.listSkills({ search: 'Beta' });

      expect(skills).toHaveLength(1);
      expect(skills[0]?.name).toBe('Beta Skill');
    });

    it('should filter by tags', async () => {
      const skills = await skillService.listSkills({ tags: ['tag1'] });

      expect(skills.length).toBeGreaterThanOrEqual(2);
      expect(skills.every((s) => s.metadata.tags.includes('tag1'))).toBe(true);
    });

    it('should sort by name', async () => {
      const skills = await skillService.listSkills(undefined, 'name');

      // Check first 3 (there may be more from default data)
      const names = skills.map((s) => s.name);
      expect(names.indexOf('Alpha Skill')).toBeLessThan(names.indexOf('Beta Skill'));
      expect(names.indexOf('Beta Skill')).toBeLessThan(names.indexOf('Gamma Skill'));
    });

    it('should sort by recent (created_at DESC)', async () => {
      const skills = await skillService.listSkills(undefined, 'recent');
      const testSkills = skills.filter((s) => s.id.startsWith('skill-list-'));

      expect(testSkills[0]?.name).toBe('Gamma Skill');
      expect(testSkills[1]?.name).toBe('Beta Skill');
      expect(testSkills[2]?.name).toBe('Alpha Skill');
    });
  });

  describe('Task-Skill Association', () => {
    beforeEach(async () => {
      // Create test task
      const now = Date.now();
      db.rawExecute(
        'INSERT INTO conversations (id, title, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['task-1', 'Test Task', 'default', now, now]
      );

      // Create test skills
      await skillService.createSkill(createTestSkill({ id: 'assoc-skill-1', name: 'Skill 1' }));
      await skillService.createSkill(createTestSkill({ id: 'assoc-skill-2', name: 'Skill 2' }));
    });

    describe('enableSkillForTask', () => {
      it('should create skill-task association', async () => {
        await skillService.enableSkillForTask('task-1', 'assoc-skill-1');

        const taskSkills = await skillService.getTaskSkills('task-1');

        expect(taskSkills).toHaveLength(1);
        expect(taskSkills[0]?.skillId).toBe('assoc-skill-1');
        expect(taskSkills[0]?.enabled).toBe(true);
      });

      it('should update existing association if already exists', async () => {
        await skillService.enableSkillForTask('task-1', 'assoc-skill-1', 5);
        await skillService.enableSkillForTask('task-1', 'assoc-skill-1', 10);

        const taskSkills = await skillService.getTaskSkills('task-1');

        expect(taskSkills).toHaveLength(1);
        expect(taskSkills[0]?.priority).toBe(10);
      });

      it('should update skill last_used_at', async () => {
        const beforeRows = db.rawQuery<{ last_used_at: number | null }>(
          'SELECT last_used_at FROM skills WHERE id = ?',
          ['assoc-skill-1']
        );

        await skillService.enableSkillForTask('task-1', 'assoc-skill-1');

        const afterRows = db.rawQuery<{ last_used_at: number | null }>(
          'SELECT last_used_at FROM skills WHERE id = ?',
          ['assoc-skill-1']
        );

        expect(afterRows[0]?.last_used_at).not.toBeNull();
        expect(afterRows[0]?.last_used_at).toBeGreaterThan(beforeRows[0]?.last_used_at ?? 0);
      });
    });

    describe('disableSkillForTask', () => {
      it('should disable skill for task', async () => {
        await skillService.enableSkillForTask('task-1', 'assoc-skill-1');
        await skillService.disableSkillForTask('task-1', 'assoc-skill-1');

        const taskSkills = await skillService.getTaskSkills('task-1');

        expect(taskSkills).toHaveLength(1);
        expect(taskSkills[0]?.enabled).toBe(false);
      });
    });

    describe('removeSkillFromTask', () => {
      it('should remove skill association from task', async () => {
        await skillService.enableSkillForTask('task-1', 'assoc-skill-1');
        await skillService.enableSkillForTask('task-1', 'assoc-skill-2');

        await skillService.removeSkillFromTask('task-1', 'assoc-skill-1');

        const taskSkills = await skillService.getTaskSkills('task-1');

        expect(taskSkills).toHaveLength(1);
        expect(taskSkills[0]?.skillId).toBe('assoc-skill-2');
      });
    });

    describe('setTaskSkills', () => {
      it('should replace all skills for a task', async () => {
        await skillService.enableSkillForTask('task-1', 'assoc-skill-1');

        await skillService.setTaskSkills('task-1', ['assoc-skill-2']);

        const taskSkills = await skillService.getTaskSkills('task-1');

        expect(taskSkills).toHaveLength(1);
        expect(taskSkills[0]?.skillId).toBe('assoc-skill-2');
      });

      it('should set priority based on order', async () => {
        await skillService.setTaskSkills('task-1', ['assoc-skill-1', 'assoc-skill-2']);

        const taskSkills = await skillService.getTaskSkills('task-1');
        const skill1 = taskSkills.find((s) => s.skillId === 'assoc-skill-1');
        const skill2 = taskSkills.find((s) => s.skillId === 'assoc-skill-2');

        // First skill should have higher priority
        expect(skill1?.priority).toBe(2);
        expect(skill2?.priority).toBe(1);
      });

      it('should handle empty skill list', async () => {
        await skillService.enableSkillForTask('task-1', 'assoc-skill-1');

        await skillService.setTaskSkills('task-1', []);

        const taskSkills = await skillService.getTaskSkills('task-1');
        expect(taskSkills).toHaveLength(0);
      });
    });

    describe('getTaskSkills', () => {
      it('should return skills ordered by priority DESC', async () => {
        await skillService.enableSkillForTask('task-1', 'assoc-skill-1', 1);
        await skillService.enableSkillForTask('task-1', 'assoc-skill-2', 10);

        const taskSkills = await skillService.getTaskSkills('task-1');

        expect(taskSkills[0]?.skillId).toBe('assoc-skill-2'); // Higher priority first
        expect(taskSkills[1]?.skillId).toBe('assoc-skill-1');
      });
    });
  });

  describe('getSkillsStats', () => {
    beforeEach(async () => {
      await skillService.createSkill(createTestSkill({
        id: 'stats-skill-1',
        category: 'cat-x',
      }));
      await skillService.createSkill(createTestSkill({
        id: 'stats-skill-2',
        category: 'cat-x',
      }));
      await skillService.createSkill(createTestSkill({
        id: 'stats-skill-3',
        category: 'cat-y',
      }));
    });

    it('should return total skill count', async () => {
      const stats = await skillService.getSkillsStats();

      expect(stats.total).toBeGreaterThanOrEqual(3);
    });

    it('should return count by category', async () => {
      const stats = await skillService.getSkillsStats();

      expect(stats.byCategory['cat-x']).toBe(2);
      expect(stats.byCategory['cat-y']).toBe(1);
    });
  });
});
