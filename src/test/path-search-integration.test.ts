import { vi, describe, it, expect, beforeEach } from 'vitest';
import { repositoryService } from '@/services/repository-service';

// Mock the Tauri core API
const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn().mockImplementation(async (...args) => args.join('/')),
  dirname: vi.fn().mockImplementation(async (path) => path.split('/').slice(0, -1).join('/')),
}));

// Mock Stat to avoid actual FS calls
vi.mock('@tauri-apps/plugin-fs', () => ({
  stat: vi.fn().mockResolvedValue({ mtime: new Date() }),
  readTextFile: vi.fn().mockResolvedValue(''),
}));

// UNMOCK repository service to use the real one for integration test
vi.unmock('@/services/repository-service');

describe('RepositoryService - Path Search Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call search_files_fast with correct arguments', async () => {
    const rootPath = '/test/project';
    const query = 'docs/package.json';
    
    mockInvoke.mockResolvedValue([
      {
        name: 'package.json',
        path: '/test/project/docs/package.json',
        is_directory: false,
        score: 1000,
      }
    ]);

    const results = await repositoryService.searchFiles(rootPath, query);

    expect(mockInvoke).toHaveBeenCalledWith('search_files_fast', {
      query: query.trim(),
      rootPath: rootPath,
      maxResults: 20,
    });
    
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('package.json');
    expect(results[0].path).toBe('/test/project/docs/package.json');
  });

  it('should handle path search with slashes correctly', async () => {
    const rootPath = '/test/project';
    const query = 'src/components/button';
    
    mockInvoke.mockResolvedValue([
      {
        name: 'button.tsx',
        path: '/test/project/src/components/button.tsx',
        is_directory: false,
        score: 800,
      }
    ]);

    const results = await repositoryService.searchFiles(rootPath, query);

    expect(mockInvoke).toHaveBeenCalledWith('search_files_fast', {
      query: query.trim(),
      rootPath: rootPath,
      maxResults: 20,
    });
    
    expect(results[0].name).toBe('button.tsx');
  });
});
