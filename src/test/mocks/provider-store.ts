// src/test/mocks/provider-store.ts
// Centralized mock for @/providers/stores/provider-store
// Used by 6+ test files

import { vi } from 'vitest';

export const createMockUseProviderStore = (
  overrides: { getState?: () => Record<string, unknown> } = {}
) => ({
  getState: vi.fn().mockReturnValue(overrides.getState ?? (() => ({}))),
});

export const mockUseProviderStore = createMockUseProviderStore();

export const mockProviderStore = {
  useProviderStore: mockUseProviderStore,
};

/**
 * Mock module for vi.mock('@/providers/stores/provider-store', ...)
 * Usage:
 * ```typescript
 * vi.mock('@/providers/stores/provider-store', () => mockProviderStore);
 * ```
 */
export default mockProviderStore;
