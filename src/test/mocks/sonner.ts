// src/test/mocks/sonner.ts
// Centralized mock for sonner toast
// Used by 10+ test files

import { vi } from 'vitest';

export const createMockToast = () => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
});

export const mockToast = {
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  Toaster: vi.fn(),
};

/**
 * Mock module for vi.mock('sonner', ...)
 * Usage:
 * ```typescript
 * vi.mock('sonner', () => mockToast);
 * ```
 */
export default mockToast;
