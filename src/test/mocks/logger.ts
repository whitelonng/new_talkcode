// src/test/mocks/logger.ts
// Centralized mock for @/lib/logger
// Used by 50+ test files

import { vi } from 'vitest';

export const createMockLogger = () => ({
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

export const mockLogger = {
  logger: createMockLogger(),
  default: createMockLogger(),
};

/**
 * Mock module for vi.mock('@/lib/logger', ...)
 * Usage:
 * ```typescript
 * vi.mock('@/lib/logger', () => mockLogger);
 * ```
 */
export default mockLogger;
