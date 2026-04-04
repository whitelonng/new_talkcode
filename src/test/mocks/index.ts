// src/test/mocks/index.ts
// Centralized test mocks
//
// Usage:
// ```typescript
// import { mockLogger } from '@/test/mocks';
// vi.mock('@/lib/logger', () => mockLogger);
// ```

export { createMockDatabaseService, mockDatabaseService } from './database-service';
export { createMockEditReviewStore, mockEditReviewStore } from './edit-review-store';
// High-frequency mocks (used 10+ times)
export { createMockLogger, mockLogger } from './logger';
export { createMockModelLoader, mockModelLoader } from './model-loader';
export { createMockModels, MODEL_CONSTANTS, mockModels } from './models';
export { mockModelsConfig } from './models-config';
export { createMockNotificationService, mockNotificationService } from './notification-service';
export {
  createMockUseProviderStore,
  mockProviderStore,
  mockUseProviderStore,
} from './provider-store';
// Medium-frequency mocks
export { createMockRepositoryService, mockRepositoryService } from './repository-service';
export { createMockNormalizeFilePath, mockRepositoryUtils } from './repository-utils';
export {
  createMockSettingsManager,
  createMockUseSettingsStore,
  mockSettingsManager,
  mockSettingsStore,
  mockUseSettingsStore,
} from './settings-store';
export { createMockToast, mockToast } from './sonner';
export { createMockTaskService, mockTaskService } from './task-service';
export { createMockTauriPath, mockTauriPath } from './tauri-path';
export { createMockTodoStore, mockTodoStore } from './todo-store';
export { createMockWorkspaceRootService, mockWorkspaceRootService } from './workspace-root-service';
