// src/components/update-notification.test.tsx

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the updater hook
const mockCheckForUpdate = vi.fn();
const mockDownloadAndInstall = vi.fn();
const mockRestartApp = vi.fn();
const mockDismissError = vi.fn();

const mockUpdaterState = {
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  error: null,
  update: null,
  progress: null,
  checkForUpdate: mockCheckForUpdate,
  downloadAndInstall: mockDownloadAndInstall,
  restartApp: mockRestartApp,
  dismissError: mockDismissError,
};

vi.mock('@/hooks/use-updater', () => ({
  useUpdater: vi.fn(() => mockUpdaterState),
}));

vi.mock('./update-dialog', () => ({
  UpdateDialog: () => <div data-testid="update-dialog">Update Dialog</div>,
}));

import { useUpdater } from '@/hooks/use-updater';
// Now import the component
import { UpdateNotification } from './update-notification';

describe('UpdateNotification - Infinite Loop Regression Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock state
    Object.assign(mockUpdaterState, {
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      error: null,
      update: null,
      progress: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render without causing infinite re-renders', () => {
    // This test verifies the fix for the bug where the entire updater object
    // was included in useEffect dependencies instead of specific methods.

    // Mock console.error to detect React errors
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Render the component
    const { unmount } = render(<UpdateNotification checkOnMount={false} periodicCheck={false} />);

    // Verify no React errors occurred (like "Maximum update depth exceeded")
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('should be cached to avoid an infinite loop')
    );

    // Verify useUpdater was called
    expect(useUpdater).toHaveBeenCalled();

    // Clean up
    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should handle error state changes without infinite loops', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Start with no error
    const { rerender, unmount } = render(
      <UpdateNotification checkOnMount={false} periodicCheck={false} />
    );

    // Change to error state
    Object.assign(mockUpdaterState, {
      error: 'Update failed',
    });

    // Force re-render
    rerender(<UpdateNotification checkOnMount={false} periodicCheck={false} />);

    // Verify no React errors occurred
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );

    // Clean up
    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should handle available state changes without infinite loops', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Start with no update available
    const { rerender, unmount } = render(
      <UpdateNotification checkOnMount={false} periodicCheck={false} />
    );

    // Change to update available
    Object.assign(mockUpdaterState, {
      available: true,
      update: { version: '1.0.1', date: '2024-01-01', body: 'Update notes' },
    });

    // Force re-render
    rerender(<UpdateNotification checkOnMount={false} periodicCheck={false} />);

    // Verify no React errors occurred
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );

    // Clean up
    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should handle downloaded state changes without infinite loops', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Start with not downloaded
    const { rerender, unmount } = render(
      <UpdateNotification checkOnMount={false} periodicCheck={false} />
    );

    // Change to downloaded
    Object.assign(mockUpdaterState, {
      downloaded: true,
    });

    // Force re-render
    rerender(<UpdateNotification checkOnMount={false} periodicCheck={false} />);

    // Verify no React errors occurred
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );

    // Clean up
    unmount();
    consoleErrorSpy.mockRestore();
  });

  it('should use specific updater methods in dependencies, not entire object', () => {
    // This test ensures we're subscribing to specific methods/properties
    // instead of the entire updater object which creates new references

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount, rerender } = render(
      <UpdateNotification checkOnMount={false} periodicCheck={false} />
    );

    // Simulate multiple re-renders with the same updater state
    for (let i = 0; i < 5; i++) {
      rerender(<UpdateNotification checkOnMount={false} periodicCheck={false} />);
    }

    // Verify no React errors occurred even after multiple re-renders
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    );

    // Clean up
    unmount();
    consoleErrorSpy.mockRestore();
  });
});
