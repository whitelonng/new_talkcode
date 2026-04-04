// src/test/mocks/settings-store.ts
// Centralized mock for @/stores/settings-store
// Used by 23+ test files

import { vi } from 'vitest';

// Default mock values
const DEFAULT_ROOT_PATH = '/test/root';
const DEFAULT_TASK_ID = 'conv-123';
const DEFAULT_LANGUAGE = 'en';

export const createMockSettingsManager = (
  overrides: Partial<{
    getCurrentRootPath: string;
    getCurrentTaskId: string;
    getProject: unknown;
    getSync: unknown;
    getBatchSync: Record<string, unknown>;
    db: {
      select: unknown[];
      execute: { rowsAffected: number };
    };
  }> = {}
) => ({
  getCurrentRootPath: vi.fn().mockReturnValue(overrides.getCurrentRootPath ?? DEFAULT_ROOT_PATH),
  getCurrentTaskId: vi.fn().mockReturnValue(overrides.getCurrentTaskId ?? DEFAULT_TASK_ID),
  getProject: vi.fn().mockResolvedValue(overrides.getProject ?? null),
  getSync: vi.fn().mockReturnValue(overrides.getSync ?? undefined),
  getBatchSync: vi.fn().mockReturnValue(overrides.getBatchSync ?? {}),
  getAutoApproveEditsGlobal: vi.fn(() => false),
  getAutoApprovePlanGlobal: vi.fn(() => false),
  getAutoCodeReviewGlobal: vi.fn(() => false),
  getRalphLoopEnabled: vi.fn(() => false),
  getTraceEnabled: vi.fn(() => true),
  setAutoApproveEditsGlobal: vi.fn().mockResolvedValue(undefined),
  setAutoApprovePlanGlobal: vi.fn().mockResolvedValue(undefined),
  setAutoCodeReviewGlobal: vi.fn().mockResolvedValue(undefined),
  setRalphLoopEnabled: vi.fn().mockResolvedValue(undefined),
  setTraceEnabled: vi.fn().mockResolvedValue(undefined),
  db: {
    select: vi.fn().mockResolvedValue(overrides.db?.select ?? []),
    execute: vi.fn().mockResolvedValue(overrides.db?.execute ?? { rowsAffected: 0 }),
  },
});

export const createMockUseSettingsStore = (
  overrides: Partial<{
    language: string;
    theme: string;
    settings: Record<string, unknown>;
  }> = {}
) => {
  const state = {
    language: overrides.language ?? DEFAULT_LANGUAGE,
    theme: overrides.theme ?? 'dark',
    getReasoningEffort: vi.fn(() => 'medium'),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    getAutoApprovePlanGlobal: vi.fn(() => false),
    getAutoCodeReviewGlobal: vi.fn(() => false),
    getRalphLoopEnabled: vi.fn(() => false),
    getTraceEnabled: vi.fn(() => true),
    setLanguage: vi.fn().mockResolvedValue(undefined),
    setAutoApproveEditsGlobal: vi.fn(),
    setAutoApprovePlanGlobal: vi.fn(),
    setAutoCodeReviewGlobal: vi.fn(),
    setRalphLoopEnabled: vi.fn(),
    setTraceEnabled: vi.fn(),
    ...overrides.settings,
  };

  const useSettingsStore = ((selector?: (state: typeof state) => unknown) =>
    selector ? selector(state) : state) as typeof import('zustand').StoreApi<typeof state> &
    ((selector?: (state: typeof state) => unknown) => unknown);

  useSettingsStore.getState = vi.fn(() => state);
  useSettingsStore.subscribe = vi.fn();
  useSettingsStore.setState = vi.fn();

  return useSettingsStore;
};

// Default instances for common use
export const mockSettingsManager = createMockSettingsManager();
export const mockUseSettingsStore = createMockUseSettingsStore();

export const mockSettingsStore = {
  settingsManager: mockSettingsManager,
  SettingsManager: vi.fn().mockImplementation(() => mockSettingsManager),
  useSettingsStore: mockUseSettingsStore,
};

/**
 * Mock module for vi.mock('@/stores/settings-store', ...)
 * Usage:
 * ```typescript
 * vi.mock('@/stores/settings-store', () => mockSettingsStore);
 * ```
 */
export default mockSettingsStore;
