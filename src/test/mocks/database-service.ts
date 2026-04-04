// src/test/mocks/database-service.ts
// Centralized mock for @/services/database-service
// Used by 9+ test files

import { vi } from 'vitest';

export const createMockDatabaseService = (
  overrides: {
    initialize?: unknown;
    db?: {
      select?: unknown[];
      execute?: { rowsAffected: number };
    };
  } = {}
) => ({
  initialize: vi.fn().mockResolvedValue(overrides.initialize ?? undefined),
  insertApiUsageEvent: vi.fn().mockResolvedValue(undefined),
  getTraces: vi.fn().mockResolvedValue([]),
  getTraceDetails: vi.fn().mockResolvedValue(null),
  startSpan: vi.fn().mockResolvedValue(undefined),
  endSpan: vi.fn().mockResolvedValue(undefined),
  db: {
    select: vi.fn().mockResolvedValue(overrides.db?.select ?? []),
    execute: vi.fn().mockResolvedValue(overrides.db?.execute ?? { rowsAffected: 0 }),
  },
});

export const mockDatabaseService = {
  databaseService: createMockDatabaseService(),
};

/**
 * Mock module for vi.mock('@/services/database-service', ...)
 * Usage:
 * ```typescript
 * vi.mock('@/services/database-service', () => mockDatabaseService);
 * ```
 */
export default mockDatabaseService;
