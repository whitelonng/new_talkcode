// SkillCard component tests

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Skill } from '@/types/skill';
import { SkillCard, SkillCardCompact } from './skill-card';

const mockLocalSkill: Skill = {
  id: 'local-skill-1',
  name: 'Local Custom Skill',
  description: 'A custom skill created locally',
  category: 'Development',
  content: {
    systemPromptFragment: 'You are helpful',
    workflowRules: 'Follow rules',
    documentation: [
      {
        type: 'inline',
        title: 'Guide',
        content: 'How to use',
      },
    ],
  },
  metadata: {
    isBuiltIn: false,
    sourceType: 'local',
    tags: ['custom', 'local'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};

const mockMarketplaceSkill: Skill = {
  id: 'marketplace-skill-1',
  name: 'Marketplace Skill',
  description: 'Downloaded from marketplace',
  category: 'Productivity',
  icon: 'https://example.com/icon.png',
  content: {
    systemPromptFragment: 'Be productive',
  },
  marketplace: {
    marketplaceId: 'mp-123',
    version: '1.0.0',
    author: 'John Doe',
    authorId: 'author-123',
    downloads: 5000,
    rating: 4.8,
  },
  metadata: {
    isBuiltIn: false,
    sourceType: 'marketplace',
    tags: ['productivity', 'popular'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};

const mockSystemSkill: Skill = {
  id: 'system-skill-1',
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

describe('SkillCard', () => {
  it('should render skill information correctly', () => {
    render(<SkillCard skill={mockLocalSkill} />);

    expect(screen.getByText('Local Custom Skill')).toBeInTheDocument();
    expect(screen.getByText('A custom skill created locally')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
  });

  // it('should show Custom badge for local custom skills', () => {
  //   render(<SkillCard skill={mockLocalSkill} />);

  //   expect(screen.getByText('Custom')).toBeInTheDocument();
  // });

  it('should show System badge for system skills', () => {
    render(<SkillCard skill={mockSystemSkill} />);

    const systemBadges = screen.getAllByText('System');
    expect(systemBadges.length).toBeGreaterThan(0);
  });

  it('should show Active badge when skill is active', () => {
    render(<SkillCard skill={mockLocalSkill} isActive={true} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should show content indicators', () => {
    render(<SkillCard skill={mockLocalSkill} />);

    expect(screen.getByTitle('System Prompt')).toBeInTheDocument();
    expect(screen.getByTitle('Workflow Rules')).toBeInTheDocument();
    expect(screen.getByTitle('Documentation')).toBeInTheDocument();
    expect(screen.getByText(/Docs \(1\)/)).toBeInTheDocument();
  });

  it('should display skill tags', () => {
    render(<SkillCard skill={mockLocalSkill} />);

    expect(screen.getByText('custom')).toBeInTheDocument();
    expect(screen.getByText('local')).toBeInTheDocument();
  });

  it('should show Edit button for custom skills', () => {
    const onEdit = vi.fn();
    render(<SkillCard skill={mockLocalSkill} onEdit={onEdit} />);

    const editButton = screen.getByTitle('Edit Skill');
    expect(editButton).toBeInTheDocument();
  });

  it('should not show Edit button for system skills', () => {
    const onEdit = vi.fn();
    render(<SkillCard skill={mockSystemSkill} onEdit={onEdit} />);

    expect(screen.queryByTitle('Edit Skill')).not.toBeInTheDocument();
  });

  it('should show Fork button when provided', () => {
    const onFork = vi.fn();
    render(<SkillCard skill={mockMarketplaceSkill} onFork={onFork} />);

    const forkButton = screen.getByTitle('Fork Skill');
    expect(forkButton).toBeInTheDocument();
  });

  it('should not show Share button for system skills', () => {
    const onShare = vi.fn();
    render(<SkillCard skill={mockSystemSkill} onShare={onShare} />);

    expect(screen.queryByTitle('Share to Marketplace')).not.toBeInTheDocument();
  });

  it('should show Delete button for custom skills', () => {
    const onDelete = vi.fn();
    render(<SkillCard skill={mockLocalSkill} onDelete={onDelete} />);

    const deleteButton = screen.getByTitle('Delete Skill');
    expect(deleteButton).toBeInTheDocument();
  });

  it('should not show Delete button for system skills', () => {
    const onDelete = vi.fn();
    render(<SkillCard skill={mockSystemSkill} onDelete={onDelete} />);

    expect(screen.queryByTitle('Delete Skill')).not.toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const onClick = vi.fn();
    render(<SkillCard skill={mockLocalSkill} onClick={onClick} />);

    const card = screen.getByText('Local Custom Skill').closest('div')!;
    fireEvent.click(card);

    expect(onClick).toHaveBeenCalled();
  });

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<SkillCard skill={mockLocalSkill} onEdit={onEdit} />);

    const editButton = screen.getByTitle('Edit Skill');
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalled();
  });

  it('should call onFork when fork button is clicked', () => {
    const onFork = vi.fn();
    render(<SkillCard skill={mockLocalSkill} onFork={onFork} />);

    const forkButton = screen.getByTitle('Fork Skill');
    fireEvent.click(forkButton);

    expect(onFork).toHaveBeenCalled();
  });

  it('should call onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<SkillCard skill={mockLocalSkill} onDelete={onDelete} />);

    const deleteButton = screen.getByTitle('Delete Skill');
    fireEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalled();
  });

  it('should call onToggle when activate/deactivate button is clicked', () => {
    const onToggle = vi.fn();
    render(<SkillCard skill={mockLocalSkill} onToggle={onToggle} />);

    const toggleButton = screen.getByText('Activate');
    fireEvent.click(toggleButton);

    expect(onToggle).toHaveBeenCalledWith(mockLocalSkill);
  });

  it('should stop propagation when action buttons are clicked', () => {
    const onClick = vi.fn();
    const onEdit = vi.fn();

    render(<SkillCard skill={mockLocalSkill} onClick={onClick} onEdit={onEdit} />);

    const editButton = screen.getByTitle('Edit Skill');
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('should hide actions when showActions is false', () => {
    render(<SkillCard skill={mockLocalSkill} showActions={false} />);

    expect(screen.queryByText('View Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
  });

  it('should show loading state for toggle button', () => {
    render(<SkillCard skill={mockLocalSkill} isToggling={true} onToggle={vi.fn()} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show Deactivate when skill is active', () => {
    render(<SkillCard skill={mockLocalSkill} isActive={true} onToggle={vi.fn()} />);

    expect(screen.getByText('Deactivate')).toBeInTheDocument();
  });

  it('should show Shared badge when skill is shared', () => {
    const sharedSkill = {
      ...mockLocalSkill,
      metadata: {
        ...mockLocalSkill.metadata,
        isShared: true,
      },
    };

    render(<SkillCard skill={sharedSkill} />);

    expect(screen.getByText('Shared')).toBeInTheDocument();
  });

  it('should truncate long tag lists', () => {
    const skillWithManyTags = {
      ...mockLocalSkill,
      metadata: {
        ...mockLocalSkill.metadata,
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
      },
    };

    render(<SkillCard skill={skillWithManyTags} />);

    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('tag3')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument(); // Shows +2 for remaining tags
  });
});

describe('SkillCardCompact', () => {
  it('should render compact skill card', () => {
    render(<SkillCardCompact skill={mockLocalSkill} />);

    expect(screen.getByText('Local Custom Skill')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
  });

  it('should call onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<SkillCardCompact skill={mockLocalSkill} onToggle={onToggle} />);

    const card = screen.getByText('Local Custom Skill').closest('div')!;
    fireEvent.click(card);

    expect(onToggle).toHaveBeenCalledWith(mockLocalSkill);
  });

  it('should show Active badge when active', () => {
    render(<SkillCardCompact skill={mockLocalSkill} isActive={true} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should display skill icon when available', () => {
    render(<SkillCardCompact skill={mockMarketplaceSkill} />);

    const img = screen.getByAltText('Marketplace Skill');
    expect(img).toHaveAttribute('src', 'https://example.com/icon.png');
  });

  it('should show default icon when no icon provided', () => {
    const { container } = render(<SkillCardCompact skill={mockLocalSkill} />);

    // Check for the Zap icon SVG
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});
