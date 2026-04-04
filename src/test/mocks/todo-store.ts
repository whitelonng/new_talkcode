// src/test/mocks/todo-store.ts
// Centralized mock for ../stores/todo-store

import { vi } from 'vitest';

export const createMockTodoStore = (overrides: { todos?: unknown[]; setTodos?: unknown } = {}) => ({
  getState: vi.fn(() => ({
    todos: overrides.todos ?? [],
    setTodos: overrides.setTodos ?? vi.fn(),
  })),
  subscribe: vi.fn(),
  setState: vi.fn(),
});

export const mockTodoStore = {
  useTodoStore: createMockTodoStore(),
};

/**
 * Mock module for vi.mock('../stores/todo-store', ...)
 */
export default mockTodoStore;
