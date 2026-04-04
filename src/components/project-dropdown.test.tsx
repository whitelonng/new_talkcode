// src/components/project-dropdown.test.tsx

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/services/database-service';
import { mockToast } from '@/test/mocks';

// Mock dependencies
vi.mock('sonner', () => mockToast);

// Mock projects data
const mockProjects: Project[] = [
  {
    id: 'default',
    name: 'Default Project',
    description: '',
    root_path: '/path/to/default',
    created_at: Date.now(),
    updated_at: Date.now(),
    context: '',
    rules: '',
  },
  {
    id: 'project-1',
    name: 'Project 1',
    description: '',
    root_path: '/path/to/project1',
    created_at: Date.now(),
    updated_at: Date.now(),
    context: '',
    rules: '',
  },
];

const mockLoadProjects = vi.fn();
const mockRefreshProjects = vi.fn();

// Mock project store - ProjectDropdown now uses useProjectStore
vi.mock('@/stores/project-store', () => ({
  useProjectStore: vi.fn((selector) => {
    const state = {
      projects: mockProjects,
      isLoading: false,
      loadProjects: mockLoadProjects,
      refreshProjects: mockRefreshProjects,
    };
    return selector(state);
  }),
}));

// Now import the component
import { ProjectDropdown } from './project-dropdown';

describe('ProjectDropdown - Infinite Loop Regression Test', () => {
  const mockOnProjectSelect = vi.fn().mockResolvedValue(undefined);
  const mockOnImportRepository = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render without causing infinite re-renders', async () => {
    // This test verifies that the component renders without infinite loops
    // by using useProjectStore for shared state management

    // Mock console.error to detect React errors
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Render the component
    const { unmount } = render(
      <ProjectDropdown
        currentProjectId="default"
        onProjectSelect={mockOnProjectSelect}
        onImportRepository={mockOnImportRepository}
        isLoading={false}
      />
    );

    // Wait for the component to load projects
    await screen.findByText('Default Project');

    // Verify no React errors occurred (like "Maximum update depth exceeded")
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('should be cached to avoid an infinite loop')
    );

    // Verify loadProjects was called on mount
    expect(mockLoadProjects).toHaveBeenCalled();
    // Should only be called once (not in infinite loop)
    expect(mockLoadProjects.mock.calls.length).toBeLessThanOrEqual(2);

    // Clean up
    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should handle currentProjectId changes without infinite loops', async () => {
    // Mock console.error to detect React errors
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Render with initial project
    const { rerender, unmount } = render(
      <ProjectDropdown
        currentProjectId="default"
        onProjectSelect={mockOnProjectSelect}
        onImportRepository={mockOnImportRepository}
        isLoading={false}
      />
    );

    // Wait for initial render
    await screen.findByText('Default Project');

    // Get initial call count
    const initialCallCount = mockLoadProjects.mock.calls.length;

    // Change currentProjectId
    rerender(
      <ProjectDropdown
        currentProjectId="project-1"
        onProjectSelect={mockOnProjectSelect}
        onImportRepository={mockOnImportRepository}
        isLoading={false}
      />
    );

    // Wait for re-render - should show Project 1 now
    await screen.findByText('Project 1');

    // With useProjectStore, loadProjects should NOT be called again
    // when currentProjectId changes - the store caches projects
    // and we use useMemo to derive currentProject from projects list
    const finalCallCount = mockLoadProjects.mock.calls.length;
    expect(finalCallCount).toBe(initialCallCount);

    // Verify no React errors occurred
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );

    // Clean up
    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should maintain stable state when currentProjectId unchanged', async () => {
    // This test ensures no unnecessary re-renders when props don't change

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender, unmount } = render(
      <ProjectDropdown
        currentProjectId="default"
        onProjectSelect={mockOnProjectSelect}
        onImportRepository={mockOnImportRepository}
        isLoading={false}
      />
    );

    await screen.findByText('Default Project');

    const callCountAfterMount = mockLoadProjects.mock.calls.length;

    // Re-render multiple times with same props
    for (let i = 0; i < 3; i++) {
      rerender(
        <ProjectDropdown
          currentProjectId="default"
          onProjectSelect={mockOnProjectSelect}
          onImportRepository={mockOnImportRepository}
          isLoading={false}
        />
      );
    }

    // loadProjects should not be called again if already initialized
    const finalCallCount = mockLoadProjects.mock.calls.length;
    expect(finalCallCount).toBe(callCountAfterMount);

    // Verify no React errors occurred
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );

    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should display correct project name based on currentProjectId', async () => {
    // This test verifies that the useMemo correctly derives currentProject

    const { rerender, unmount } = render(
      <ProjectDropdown
        currentProjectId="default"
        onProjectSelect={mockOnProjectSelect}
        onImportRepository={mockOnImportRepository}
        isLoading={false}
      />
    );

    // Should show Default Project
    await screen.findByText('Default Project');

    // Change to project-1
    rerender(
      <ProjectDropdown
        currentProjectId="project-1"
        onProjectSelect={mockOnProjectSelect}
        onImportRepository={mockOnImportRepository}
        isLoading={false}
      />
    );

    // Should now show Project 1
    await screen.findByText('Project 1');

    // Change to non-existent project
    rerender(
      <ProjectDropdown
        currentProjectId="non-existent"
        onProjectSelect={mockOnProjectSelect}
        onImportRepository={mockOnImportRepository}
        isLoading={false}
      />
    );

    // Should show "Select Project" for non-existent project
    await screen.findByText('Select Project');

    unmount();
  });
});
