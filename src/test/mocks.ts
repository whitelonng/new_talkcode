// src/test/mocks.ts
import { vi } from 'vitest';

// ============================================================================
// Logger Mock
// ============================================================================
export const createMockLogger = () => {
  const loggerObj = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    ...loggerObj,
    logger: loggerObj,
    default: loggerObj,
  };
};

export const mockLogger = createMockLogger();

// ============================================================================
// Settings Store Mock
// ============================================================================
export const mockSettingsStore = {
  settingsManager: {
    getCurrentRootPath: vi.fn().mockReturnValue('/test/root'),
    getCurrentTaskId: vi.fn().mockReturnValue('conv-123'),
    getCurrentConversationId: vi.fn().mockReturnValue('conv-123'),
    getCurrentProjectId: vi.fn().mockResolvedValue('default'),
    getProject: vi.fn().mockResolvedValue({ id: 'default', name: 'Default' }),
    getSync: vi.fn().mockReturnValue(undefined),
    getBatchSync: vi.fn().mockReturnValue({}),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    getAutoApprovePlanGlobal: vi.fn(() => false),
    getAutoCodeReviewGlobal: vi.fn(() => false),
    getRalphLoopEnabled: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn().mockResolvedValue(undefined),
    setAutoApprovePlanGlobal: vi.fn().mockResolvedValue(undefined),
    setAutoCodeReviewGlobal: vi.fn().mockResolvedValue(undefined),
    setRalphLoopEnabled: vi.fn().mockResolvedValue(undefined),
    db: {
      select: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    },
  },
  SettingsManager: vi.fn().mockImplementation(() => ({
    getCurrentRootPath: vi.fn().mockReturnValue('/test/root'),
    getCurrentTaskId: vi.fn().mockReturnValue('conv-123'),
    getProject: vi.fn().mockResolvedValue(null),
  })),
  useSettingsStore: {
    getState: vi.fn(() => ({
      language: 'en',
      theme: 'dark',
      assistantId: 'planner',
      getReasoningEffort: vi.fn(() => 'medium'),
      getAutoApproveEditsGlobal: vi.fn(() => false),
      getAutoApprovePlanGlobal: vi.fn(() => false),
      getAutoCodeReviewGlobal: vi.fn(() => false),
      getRalphLoopEnabled: vi.fn(() => false),
      setAutoApproveEditsGlobal: vi.fn(),
      setAutoApprovePlanGlobal: vi.fn(),
      setAutoCodeReviewGlobal: vi.fn(),
      setRalphLoopEnabled: vi.fn(),
    })),
    subscribe: vi.fn(),
    setState: vi.fn(),
  },
};

// ============================================================================
// Tauri Path Mock
// ============================================================================
export const mockTauriPath = {
  normalize: vi.fn().mockImplementation(async (path: string) => path),
  appDataDir: vi.fn().mockResolvedValue('/test/app-data'),
  join: vi.fn().mockImplementation(async (...paths: string[]) => {
    const filtered = paths.filter((p) => p && p !== '.');
    return filtered.join('/');
  }),
  dirname: vi.fn().mockImplementation(async (path: string) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }),
  isAbsolute: vi.fn().mockImplementation(async (path: string) => path.startsWith('/')),
};

// ============================================================================
// Sonner Toast Mock
// ============================================================================
export const mockToast = {
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  Toaster: vi.fn(),
};

// ============================================================================
// Task Manager Mock
// ============================================================================
export const mockTaskManager = {
  getTaskSettings: vi.fn().mockResolvedValue(null),
  updateTaskSettings: vi.fn().mockImplementation(async (_taskId: string, _settings: object) => {
    return Promise.resolve(undefined);
  }),
};

// ============================================================================
// Repository Service Mock
// ============================================================================
export const mockRepositoryService = {
  readFileWithCache: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(undefined),
  clearCache: vi.fn(),
};

// ============================================================================
// Workspace Root Service Mock
// ============================================================================
export const mockWorkspaceRootService = {
  getValidatedWorkspaceRoot: vi.fn().mockResolvedValue('/test/root'),
  getEffectiveWorkspaceRoot: vi.fn().mockResolvedValue('/test/root'),
};

// ============================================================================
// Database Service Mock
// ============================================================================
export const mockDatabaseService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  db: {
    select: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
  },
};
