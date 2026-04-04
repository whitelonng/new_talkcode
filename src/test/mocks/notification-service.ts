// src/test/mocks/notification-service.ts
// Centralized mock for @/services/notification-service

import { vi } from 'vitest';

export const createMockNotificationService = () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
});

export const mockNotificationService = {
  notificationService: createMockNotificationService(),
};

/**
 * Mock module for vi.mock('@/services/notification-service', ...)
 */
export default mockNotificationService;
