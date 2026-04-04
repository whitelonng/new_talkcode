import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockExists = vi.hoisted(() => vi.fn());
const mockNormalize = vi.hoisted(() => vi.fn());
const mockDirname = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: mockExists,
}));

vi.mock('@tauri-apps/api/path', () => ({
  normalize: mockNormalize,
  dirname: mockDirname,
}));

import { findWorkspaceRoot } from './lsp-servers';

const ROOT_PATTERNS = ['package.json'];

function setupDefaultMocks() {
  mockNormalize.mockImplementation((path: string) => path);
  mockDirname.mockImplementation((path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const idx = normalized.lastIndexOf('/');
    if (idx <= 0) return '/';
    return normalized.slice(0, idx);
  });
}

describe('findWorkspaceRoot', () => {
  beforeEach(() => {
    mockExists.mockReset();
    mockNormalize.mockReset();
    mockDirname.mockReset();
    setupDefaultMocks();
  });

  it('returns workspace root for Windows paths with backslashes', async () => {
    const repoRoot = 'C:\\repo';
    const filePath = 'C:\\repo\\apps\\web\\src\\main.ts';

    mockExists.mockImplementation(async (path: string) => {
      return path === 'C:\\repo\\apps\\web\\package.json';
    });

    const root = await findWorkspaceRoot(filePath, 'typescript', repoRoot);

    expect(root).toBe('C:\\repo\\apps\\web');
  });

  it('returns repo root when no root pattern matches', async () => {
    const repoRoot = '/repo';
    const filePath = '/repo/src/main.ts';

    mockExists.mockResolvedValue(false);

    const root = await findWorkspaceRoot(filePath, 'typescript', repoRoot);

    expect(root).toBe(repoRoot);
  });

  it('returns nearest workspace root for Unix paths', async () => {
    const repoRoot = '/repo';
    const filePath = '/repo/apps/web/src/main.ts';

    mockExists.mockImplementation(async (path: string) => {
      return path === '/repo/apps/web/package.json';
    });

    const root = await findWorkspaceRoot(filePath, 'typescript', repoRoot);

    expect(root).toBe('/repo/apps/web');
  });
});
