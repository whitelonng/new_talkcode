// src/test/mocks/workspace-root-service.ts
// Centralized mock for @/services/workspace-root-service
// Used by 9+ test files

import { vi } from 'vitest';

const DEFAULT_ROOT = '/test/root';

export const createMockWorkspaceRootService = (
  overrides: { getValidatedWorkspaceRoot?: string; getEffectiveWorkspaceRoot?: string } = {}
) => ({
  getValidatedWorkspaceRoot: vi
    .fn()
    .mockResolvedValue(overrides.getValidatedWorkspaceRoot ?? DEFAULT_ROOT),
  getEffectiveWorkspaceRoot: vi
    .fn()
    .mockResolvedValue(overrides.getEffectiveWorkspaceRoot ?? DEFAULT_ROOT),
});

// Default instance
export const mockWorkspaceRootService = createMockWorkspaceRootService();

/**
 * Mock module for vi.mock('@/services/workspace-root-service', ...)
 * Usage:
 * ```typescript
 * vi.mock('@/services/workspace-root-service', () => mockWorkspaceRootService);
 * ```
 */
export default mockWorkspaceRootService;
