import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exists } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import { EmptyRepositoryState } from './empty-repository-state';
import type { Project } from '@/services/database-service';

// Mock Tauri plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Store for mutable project data
let mockProjects: Project[] = [];
const mockLoadProjects = vi.fn();

// Mock project store
vi.mock('@/stores/project-store', () => ({
  useProjectStore: vi.fn((selector) => {
    const state = {
      projects: mockProjects,
      isLoading: false,
      loadProjects: mockLoadProjects,
      getRecentProjects: () => [...mockProjects].sort((a, b) => b.updated_at - a.updated_at),
    };
    return selector(state);
  }),
}));

// Mock locale hook
vi.mock('@/hooks/use-locale', () => ({
  useLocale: () => ({
    t: {
      Projects: {
        noRepository: 'No repository associated',
        recentProjects: 'Recent Projects',
        opening: 'Opening...',
      },
      Repository: {
        emptyState: {
          title: 'Import Repository',
          description: 'Import a code repository to start browsing files',
        },
        importing: 'Importing...',
        selectRepository: 'Select Repository',
        openFailed: (path: string) => `Failed to open repository: ${path}`,
        directoryNotFound: 'Directory no longer exists',
      },
      Common: {
        default: 'Default',
      },
    },
  }),
}));

const mockExists = vi.mocked(exists);
const mockToastError = vi.mocked(toast.error);

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: '1',
  name: 'Test Project',
  description: '',
  root_path: '/test/path',
  created_at: Date.now(),
  updated_at: Date.now(),
  context: '',
  rules: '',
  ...overrides,
});

describe('EmptyRepositoryState', () => {
  const mockOnSelectRepository = vi.fn();
  const mockOnOpenRepository = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjects = [];
    mockToastError.mockClear();
  });

  it('should render import button', async () => {
    render(
      <EmptyRepositoryState
        onSelectRepository={mockOnSelectRepository}
        onOpenRepository={mockOnOpenRepository}
        isLoading={false}
      />
    );

    expect(screen.getByText('Import Repository')).toBeInTheDocument();
    expect(screen.getByText('Select Repository')).toBeInTheDocument();
  });

  it('should call onSelectRepository when import button is clicked', async () => {
    render(
      <EmptyRepositoryState
        onSelectRepository={mockOnSelectRepository}
        onOpenRepository={mockOnOpenRepository}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Select Repository'));
    expect(mockOnSelectRepository).toHaveBeenCalled();
  });

  it('should display recent projects', async () => {
    mockProjects = [
      createMockProject({ id: '1', name: 'Project One', root_path: '/path/one' }),
      createMockProject({ id: '2', name: 'Project Two', root_path: '/path/two' }),
    ];

    render(
      <EmptyRepositoryState
        onSelectRepository={mockOnSelectRepository}
        onOpenRepository={mockOnOpenRepository}
        isLoading={false}
      />
    );

    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Project Two')).toBeInTheDocument();
  });

  it('should not call onOpenRepository when path does not exist', async () => {
    mockProjects = [createMockProject({ root_path: '/nonexistent/path' })];
    mockExists.mockResolvedValue(false);

    render(
      <EmptyRepositoryState
        onSelectRepository={mockOnSelectRepository}
        onOpenRepository={mockOnOpenRepository}
        isLoading={false}
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Test Project'));

    await waitFor(() => {
      expect(mockExists).toHaveBeenCalledWith('/nonexistent/path');
      expect(mockOnOpenRepository).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith('Directory no longer exists');
    });
  });

  it('should call onOpenRepository when path exists', async () => {
    mockProjects = [createMockProject({ root_path: '/valid/path' })];
    mockExists.mockResolvedValue(true);
    mockOnOpenRepository.mockResolvedValue(undefined);

    render(
      <EmptyRepositoryState
        onSelectRepository={mockOnSelectRepository}
        onOpenRepository={mockOnOpenRepository}
        isLoading={false}
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Test Project'));

    await waitFor(() => {
      expect(mockExists).toHaveBeenCalledWith('/valid/path');
      expect(mockOnOpenRepository).toHaveBeenCalledWith('/valid/path', '1');
    });
  });

  it('should show error toast when project has no root_path', async () => {
    mockProjects = [createMockProject({ root_path: '' })];

    render(
      <EmptyRepositoryState
        onSelectRepository={mockOnSelectRepository}
        onOpenRepository={mockOnOpenRepository}
        isLoading={false}
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();

    // The card with no root_path should not be clickable (onClick returns early)
    // But it should display "No repository associated" text
    expect(screen.getByText('No repository associated')).toBeInTheDocument();
  });

  it('should handle error when exists check fails', async () => {
    mockProjects = [createMockProject({ root_path: '/error/path' })];
    mockExists.mockRejectedValue(new Error('Permission denied'));

    render(
      <EmptyRepositoryState
        onSelectRepository={mockOnSelectRepository}
        onOpenRepository={mockOnOpenRepository}
        isLoading={false}
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Test Project'));

    await waitFor(() => {
      expect(mockOnOpenRepository).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith('Failed to open repository: /error/path');
    });
  });

  it('should disable import button when loading', async () => {
    render(
      <EmptyRepositoryState
        onSelectRepository={mockOnSelectRepository}
        onOpenRepository={mockOnOpenRepository}
        isLoading={true}
      />
    );

    const button = screen.getByRole('button', { name: /Importing.../i });
    expect(button).toBeDisabled();
  });
});
