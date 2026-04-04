// src/test/mocks/model-loader.ts
// Centralized mock for ../lib/model-loader

import { vi } from 'vitest';

export const createMockModelLoader = (
  overrides: { getModels?: unknown[]; loadModels?: unknown[]; refreshModels?: unknown[] } = {}
) => ({
  getModels: vi.fn().mockResolvedValue(overrides.getModels ?? []),
  loadModels: vi.fn().mockResolvedValue(overrides.loadModels ?? []),
  refreshModels: vi.fn().mockResolvedValue(overrides.refreshModels ?? []),
});

export const mockModelLoader = {
  modelLoader: createMockModelLoader(),
};

/**
 * Mock module for vi.mock('../lib/model-loader', ...)
 */
export default mockModelLoader;
