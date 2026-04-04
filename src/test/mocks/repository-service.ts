// src/test/mocks/repository-service.ts
// Centralized mock for ../services/repository-service

import { vi } from 'vitest';

export const createMockRepositoryService = (
  overrides: { readFileWithCache?: string; writeFile?: unknown; clearCache?: unknown } = {}
) => ({
  readFileWithCache: vi.fn().mockResolvedValue(overrides.readFileWithCache ?? ''),
  writeFile: vi.fn().mockResolvedValue(overrides.writeFile ?? undefined),
  clearCache: vi.fn().mockReturnValue(overrides.clearCache ?? undefined),
});

export const mockRepositoryService = {
  repositoryService: createMockRepositoryService(),
};

/**
 * Mock module for vi.mock('../services/repository-service', ...)
 */
export default mockRepositoryService;
