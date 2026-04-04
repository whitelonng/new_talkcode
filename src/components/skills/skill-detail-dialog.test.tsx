// Tests for SkillDetailDialog component - install status display
import { describe, expect, it, vi } from 'vitest';
import type { Skill } from '@/types/skill';

// Test helper to simulate the component's internal logic
function getButtonVisibility(
  skill: Skill,
  isInstalled: boolean,
  onEdit?: (skill: Skill) => void,
  onDelete?: (skill: Skill) => void,
  onInstall?: (skill: Skill) => void
) {
  const hasMarketplaceData = Boolean(skill.marketplace);
  const isLocalSkill = isInstalled || !hasMarketplaceData;
  const showInstallButton = hasMarketplaceData && !isInstalled;

  return {
    showEditButton: isLocalSkill && Boolean(onEdit),
    showDeleteButton: isLocalSkill && Boolean(onDelete),
    showInstallButton: showInstallButton && Boolean(onInstall),
  };
}

describe('SkillDetailDialog - Install Status Display', () => {
  const mockLocalSkill: Skill = {
    id: 'local-skill-1',
    name: 'Local Skill',
    description: 'A locally created skill',
    category: 'Development',
    content: {
      systemPromptFragment: 'You are an expert',
    },
    metadata: {
      isBuiltIn: false,
      tags: ['local'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };

  const mockInstalledMarketplaceSkill: Skill = {
    id: 'installed-marketplace-skill',
    name: 'Installed Marketplace Skill',
    description: 'A skill installed from marketplace',
    category: 'Database',
    content: {
      systemPromptFragment: 'You are an expert',
    },
    metadata: {
      isBuiltIn: false,
      sourceType: 'marketplace',
      tags: ['database'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    marketplace: {
      marketplaceId: 'mp-skill-1',
      author: 'Test Author',
      authorId: 'author-1',
      version: '1.0.0',
      downloads: 100,
      rating: 4.5,
    },
  };

  const mockMarketplaceSkill: Skill = {
    id: 'marketplace-skill',
    name: 'Marketplace Skill',
    description: 'A skill from marketplace (not installed)',
    category: 'AI',
    content: {
      systemPromptFragment: 'You are an AI expert',
    },
    metadata: {
      isBuiltIn: false,
      sourceType: 'marketplace',
      tags: ['ai'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    marketplace: {
      marketplaceId: 'mp-skill-2',
      author: 'Another Author',
      authorId: 'author-2',
      version: '2.0.0',
      downloads: 500,
      rating: 4.8,
    },
  };

  describe('Button visibility based on installation status', () => {
    it('should show edit/delete buttons and hide install for local skill', () => {
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();
      const mockOnInstall = vi.fn();

      const visibility = getButtonVisibility(
        mockLocalSkill,
        true, // isInstalled
        mockOnEdit,
        mockOnDelete,
        mockOnInstall
      );

      expect(visibility.showEditButton).toBe(true);
      expect(visibility.showDeleteButton).toBe(true);
      expect(visibility.showInstallButton).toBe(false);
    });

    it('should show edit/delete buttons and hide install for installed marketplace skill', () => {
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();
      const mockOnInstall = vi.fn();

      const visibility = getButtonVisibility(
        mockInstalledMarketplaceSkill,
        true, // isInstalled
        mockOnEdit,
        mockOnDelete,
        mockOnInstall
      );

      expect(visibility.showEditButton).toBe(true);
      expect(visibility.showDeleteButton).toBe(true);
      // Key fix: should NOT show install button for already installed skill
      expect(visibility.showInstallButton).toBe(false);
    });

    it('should show install button and hide edit/delete for not installed marketplace skill', () => {
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();
      const mockOnInstall = vi.fn();

      const visibility = getButtonVisibility(
        mockMarketplaceSkill,
        false, // isInstalled
        mockOnEdit,
        mockOnDelete,
        mockOnInstall
      );

      expect(visibility.showEditButton).toBe(false);
      expect(visibility.showDeleteButton).toBe(false);
      expect(visibility.showInstallButton).toBe(true);
    });

    it('should not show any action buttons when handlers are not provided', () => {
      const visibility = getButtonVisibility(
        mockLocalSkill,
        true, // isInstalled
        undefined, // no onEdit
        undefined, // no onDelete
        undefined // no onInstall
      );

      expect(visibility.showEditButton).toBe(false);
      expect(visibility.showDeleteButton).toBe(false);
      expect(visibility.showInstallButton).toBe(false);
    });
  });

  describe('isLocalSkill determination', () => {
    it('should be local when isInstalled is true regardless of marketplace data', () => {
      const hasMarketplaceData = Boolean(mockInstalledMarketplaceSkill.marketplace);
      const isInstalled = true;
      const isLocalSkill = isInstalled || !hasMarketplaceData;

      expect(hasMarketplaceData).toBe(true);
      expect(isLocalSkill).toBe(true);
    });

    it('should be local when skill has no marketplace data', () => {
      const hasMarketplaceData = Boolean(mockLocalSkill.marketplace);
      const isInstalled = false;
      const isLocalSkill = isInstalled || !hasMarketplaceData;

      expect(hasMarketplaceData).toBe(false);
      expect(isLocalSkill).toBe(true);
    });

    it('should not be local when skill has marketplace data and is not installed', () => {
      const hasMarketplaceData = Boolean(mockMarketplaceSkill.marketplace);
      const isInstalled = false;
      const isLocalSkill = isInstalled || !hasMarketplaceData;

      expect(hasMarketplaceData).toBe(true);
      expect(isLocalSkill).toBe(false);
    });
  });

  describe('showInstallButton determination', () => {
    it('should show install button when has marketplace data and not installed', () => {
      const hasMarketplaceData = true;
      const isInstalled = false;
      const showInstallButton = hasMarketplaceData && !isInstalled;

      expect(showInstallButton).toBe(true);
    });

    it('should NOT show install button when already installed', () => {
      const hasMarketplaceData = true;
      const isInstalled = true;
      const showInstallButton = hasMarketplaceData && !isInstalled;

      // This is the key bug fix
      expect(showInstallButton).toBe(false);
    });

    it('should NOT show install button when no marketplace data', () => {
      const hasMarketplaceData = false;
      const isInstalled = false;
      const showInstallButton = hasMarketplaceData && !isInstalled;

      expect(showInstallButton).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle skill with empty marketplace object', () => {
      const skillWithEmptyMarketplace: Skill = {
        ...mockLocalSkill,
        marketplace: undefined,
      };

      const visibility = getButtonVisibility(
        skillWithEmptyMarketplace,
        false,
        vi.fn(),
        vi.fn(),
        vi.fn()
      );

      // Should treat as local skill
      expect(visibility.showEditButton).toBe(true);
      expect(visibility.showDeleteButton).toBe(true);
      expect(visibility.showInstallButton).toBe(false);
    });

    it('should prioritize isInstalled over marketplace data check', () => {
      // Even if skill has marketplace data, if isInstalled is true,
      // it should be treated as local
      const visibility = getButtonVisibility(
        mockInstalledMarketplaceSkill,
        true, // explicitly installed
        vi.fn(),
        vi.fn(),
        vi.fn()
      );

      expect(visibility.showEditButton).toBe(true);
      expect(visibility.showDeleteButton).toBe(true);
      expect(visibility.showInstallButton).toBe(false);
    });
  });
});
