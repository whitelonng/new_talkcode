// src/test/mocks/task-service.ts
// Centralized mock for ../services/task-service

import { vi } from 'vitest';
import type { TaskSettings } from '@/types';

export const createMockTaskService = (
  overrides: {
    getTaskSettings?: unknown;
    updateTaskSettings?: unknown;
    createTask?: unknown;
    loadTasks?: unknown;
    loadMessages?: unknown;
    selectTask?: unknown;
    deleteTask?: unknown;
    renameTask?: unknown;
    updateTaskUsage?: unknown;
    getTaskDetails?: unknown;
    loadTasksWithPagination?: unknown;
    loadTasksWithSearchPagination?: unknown;
    startNewTask?: unknown;
    generateAndUpdateTitle?: unknown;
  } = {}
) => ({
  getTaskSettings: vi.fn().mockResolvedValue(overrides.getTaskSettings ?? null),
  updateTaskSettings: vi
    .fn()
    .mockImplementation(async (_taskId: string, settings: TaskSettings) => {
      return Promise.resolve(overrides.updateTaskSettings ?? undefined);
    }),
  createTask: vi.fn().mockResolvedValue(overrides.createTask ?? 'test-task-id'),
  loadTasks: vi.fn().mockResolvedValue(overrides.loadTasks ?? []),
  loadMessages: vi.fn().mockResolvedValue(overrides.loadMessages ?? []),
  selectTask: vi.fn().mockResolvedValue(overrides.selectTask ?? undefined),
  deleteTask: vi.fn().mockResolvedValue(overrides.deleteTask ?? undefined),
  renameTask: vi.fn().mockResolvedValue(overrides.renameTask ?? undefined),
  updateTaskUsage: vi.fn().mockResolvedValue(overrides.updateTaskUsage ?? undefined),
  getTaskDetails: vi.fn().mockResolvedValue(overrides.getTaskDetails ?? null),
  loadTasksWithPagination: vi.fn().mockResolvedValue(overrides.loadTasksWithPagination ?? []),
  loadTasksWithSearchPagination: vi
    .fn()
    .mockResolvedValue(overrides.loadTasksWithSearchPagination ?? []),
  startNewTask: vi.fn().mockReturnValue(overrides.startNewTask ?? undefined),
  generateAndUpdateTitle: vi.fn().mockResolvedValue(overrides.generateAndUpdateTitle ?? undefined),
});

export const mockTaskService = {
  taskService: createMockTaskService(),
};

/**
 * Mock module for vi.mock('../services/task-service', ...)
 */
export default mockTaskService;
