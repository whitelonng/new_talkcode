// Test for SkillService - specifically for agent skill deletion
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillService } from './skill-service';
import type { SkillDatabaseService } from '../database/skill-database-service';
import type { Skill } from '@/types/skill';

// Mock the agent skill service
vi.mock('./agent-skill-service', () => ({
  getAgentSkillService: vi.fn(),
}));

describe('SkillService - Delete Operations', () => {
  let skillService: SkillService;
  let mockDbService: SkillDatabaseService;
  let mockAgentService: any;

  beforeEach(() => {
    // Create mock database service
    mockDbService = {
      getSkill: vi.fn(),
      deleteSkill: vi.fn(),
    } as any;

    // Create mock agent service
    mockAgentService = {
      getSkillByName: vi.fn(),
      deleteSkill: vi.fn(),
    };

    // Create skill service
    skillService = new SkillService(mockDbService);
  });

  describe('deleteSkill', () => {
    it('should delete a database skill', async () => {
      const mockSkill: Skill = {
        id: 'db-skill-1',
        name: 'Database Skill',
        description: 'A skill stored in database',
        category: 'general',
        content: {},
        metadata: {
          isBuiltIn: false,
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      mockDbService.getSkill = vi.fn().mockResolvedValue(mockSkill);
      mockDbService.deleteSkill = vi.fn().mockResolvedValue(undefined);

      await skillService.deleteSkill('db-skill-1');

      expect(mockDbService.getSkill).toHaveBeenCalledWith('db-skill-1');
      expect(mockDbService.deleteSkill).toHaveBeenCalledWith('db-skill-1');
    });

    it('should delete an agent skill when not found in database', async () => {
      const mockAgentSkill = {
        name: 'test-skill',
        path: '/path/to/skills/test-skill',
        frontmatter: {
          name: 'test-skill',
          description: 'An agent skill',
        },
        content: '',
        directory: {
          name: 'test-skill',
          path: '/path/to/skills/test-skill',
          hasSkillMd: true,
          hasScriptsDir: false,
          hasReferencesDir: false,
          hasAssetsDir: false,
          scriptFiles: [],
          referenceFiles: [],
          assetFiles: [],
        },
      };

      // Not in database
      mockDbService.getSkill = vi.fn().mockResolvedValue(null);

      // Setup agent service mock
      const { getAgentSkillService } = await import('./agent-skill-service');
      vi.mocked(getAgentSkillService).mockResolvedValue(mockAgentService);
      mockAgentService.getSkillByName.mockResolvedValue(mockAgentSkill);
      mockAgentService.deleteSkill.mockResolvedValue(undefined);

      await skillService.deleteSkill('test-skill');

      expect(mockDbService.getSkill).toHaveBeenCalledWith('test-skill');
      expect(mockAgentService.getSkillByName).toHaveBeenCalledWith('test-skill');
      expect(mockAgentService.deleteSkill).toHaveBeenCalledWith('test-skill');
    });

    it('should throw error when skill not found in database or agent skills', async () => {
      // Not in database
      mockDbService.getSkill = vi.fn().mockResolvedValue(null);

      // Not in agent skills
      const { getAgentSkillService } = await import('./agent-skill-service');
      vi.mocked(getAgentSkillService).mockResolvedValue(mockAgentService);
      mockAgentService.getSkillByName.mockResolvedValue(null);

      await expect(skillService.deleteSkill('non-existent-skill')).rejects.toThrow(
        'Skill "non-existent-skill" not found'
      );

      expect(mockDbService.getSkill).toHaveBeenCalledWith('non-existent-skill');
      expect(mockAgentService.getSkillByName).toHaveBeenCalledWith('non-existent-skill');
    });

    it('should handle database delete errors', async () => {
      const mockSkill: Skill = {
        id: 'db-skill-1',
        name: 'Database Skill',
        description: 'A skill stored in database',
        category: 'general',
        content: {},
        metadata: {
          isBuiltIn: false,
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      const error = new Error('Database deletion failed');
      mockDbService.getSkill = vi.fn().mockResolvedValue(mockSkill);
      mockDbService.deleteSkill = vi.fn().mockRejectedValue(error);

      await expect(skillService.deleteSkill('db-skill-1')).rejects.toThrow(
        'Database deletion failed'
      );
    });

    it('should handle agent skill delete errors', async () => {
      const mockAgentSkill = {
        name: 'test-skill',
        path: '/path/to/skills/test-skill',
        frontmatter: {
          name: 'test-skill',
          description: 'An agent skill',
        },
        content: '',
        directory: {
          name: 'test-skill',
          path: '/path/to/skills/test-skill',
          hasSkillMd: true,
          hasScriptsDir: false,
          hasReferencesDir: false,
          hasAssetsDir: false,
          scriptFiles: [],
          referenceFiles: [],
          assetFiles: [],
        },
      };

      const error = new Error('Agent skill deletion failed');
      mockDbService.getSkill = vi.fn().mockResolvedValue(null);

      const { getAgentSkillService } = await import('./agent-skill-service');
      vi.mocked(getAgentSkillService).mockResolvedValue(mockAgentService);
      mockAgentService.getSkillByName.mockResolvedValue(mockAgentSkill);
      mockAgentService.deleteSkill.mockRejectedValue(error);

      await expect(skillService.deleteSkill('test-skill')).rejects.toThrow(
        'Agent skill deletion failed'
      );
    });
  });
});
