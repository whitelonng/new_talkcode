// src/test/mocks/edit-review-store.ts
// Centralized mock for @/stores/edit-review-store

import { vi } from 'vitest';

export const createMockEditReviewStore = (
  overrides: {
    reviews?: unknown[];
    addReview?: unknown;
    updateReview?: unknown;
    removeReview?: unknown;
  } = {}
) => ({
  getState: vi.fn(() => ({
    reviews: overrides.reviews ?? [],
    addReview: overrides.addReview ?? vi.fn(),
    updateReview: overrides.updateReview ?? vi.fn(),
    removeReview: overrides.removeReview ?? vi.fn(),
  })),
  subscribe: vi.fn(),
  setState: vi.fn(),
});

export const mockEditReviewStore = {
  useEditReviewStore: createMockEditReviewStore(),
};

/**
 * Mock module for vi.mock('@/stores/edit-review-store', ...)
 */
export default mockEditReviewStore;
