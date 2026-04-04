import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGlobalShortcuts } from './use-global-shortcuts';
import { settingsManager } from '@/stores/settings-store';
import { DEFAULT_SHORTCUTS } from '@/types/shortcuts';

// Mock dependencies

vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getAllShortcuts: vi.fn(),
    setAllShortcuts: vi.fn(),
    setShortcutConfig: vi.fn(),
    resetShortcutsToDefault: vi.fn(),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn(),
  },
}));

vi.mock('@/services/window-manager-service', () => ({
  WindowManagerService: {
    createProjectWindow: vi.fn(),
  },
}));

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsManager.getAllShortcuts).mockResolvedValue(DEFAULT_SHORTCUTS);
  });

  describe('Monaco Editor shortcuts', () => {
    it('should trigger globalFileSearch (cmd+o) when inside Monaco Editor', async () => {
      const globalFileSearchHandler = vi.fn();

      const { result } = renderHook(() =>
        useGlobalShortcuts({
          globalFileSearch: globalFileSearchHandler,
        })
      );

      // Wait for shortcuts to load
      await vi.waitFor(() => {
        expect(result.current.shortcuts).toBeTruthy();
      });

      // Create a mock Monaco editor element
      const monacoEditor = document.createElement('div');
      monacoEditor.className = 'monaco-editor';
      document.body.appendChild(monacoEditor);

      const inputElement = document.createElement('textarea');
      monacoEditor.appendChild(inputElement);

      // Simulate cmd+o keypress inside Monaco editor
      const event = new KeyboardEvent('keydown', {
        key: 'o',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, 'target', {
        value: inputElement,
        writable: false,
      });

      document.dispatchEvent(event);

      // Verify that globalFileSearch was called
      expect(globalFileSearchHandler).toHaveBeenCalledTimes(1);

      // Cleanup
      document.body.removeChild(monacoEditor);
    });

    it('should trigger globalContentSearch (cmd+g) when inside Monaco Editor', async () => {
      const globalContentSearchHandler = vi.fn();

      const { result } = renderHook(() =>
        useGlobalShortcuts({
          globalContentSearch: globalContentSearchHandler,
        })
      );

      // Wait for shortcuts to load
      await vi.waitFor(() => {
        expect(result.current.shortcuts).toBeTruthy();
      });

      // Create a mock Monaco editor element
      const monacoEditor = document.createElement('div');
      monacoEditor.className = 'monaco-editor';
      document.body.appendChild(monacoEditor);

      const inputElement = document.createElement('textarea');
      monacoEditor.appendChild(inputElement);

      // Simulate cmd+g keypress inside Monaco editor
      const event = new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, 'target', {
        value: inputElement,
        writable: false,
      });

      document.dispatchEvent(event);

      // Verify that globalContentSearch was called
      expect(globalContentSearchHandler).toHaveBeenCalledTimes(1);

      // Cleanup
      document.body.removeChild(monacoEditor);
    });

    it('should trigger toggleTerminal (cmd+j) when inside Monaco Editor', async () => {
      const toggleTerminalHandler = vi.fn();

      const { result } = renderHook(() =>
        useGlobalShortcuts({
          toggleTerminal: toggleTerminalHandler,
        })
      );

      // Wait for shortcuts to load
      await vi.waitFor(() => {
        expect(result.current.shortcuts).toBeTruthy();
      });

      // Create a mock Monaco editor element
      const monacoEditor = document.createElement('div');
      monacoEditor.className = 'monaco-editor';
      document.body.appendChild(monacoEditor);

      const inputElement = document.createElement('textarea');
      monacoEditor.appendChild(inputElement);

      // Simulate cmd+j keypress inside Monaco editor
      const event = new KeyboardEvent('keydown', {
        key: 'j',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, 'target', {
        value: inputElement,
        writable: false,
      });

      document.dispatchEvent(event);

      // Verify that toggleTerminal was called
      expect(toggleTerminalHandler).toHaveBeenCalledTimes(1);

      // Cleanup
      document.body.removeChild(monacoEditor);
    });

    it('should trigger saveFile (cmd+s) when inside Monaco Editor', async () => {
      const saveFileHandler = vi.fn();

      const { result } = renderHook(() =>
        useGlobalShortcuts({
          saveFile: saveFileHandler,
        })
      );

      // Wait for shortcuts to load
      await vi.waitFor(() => {
        expect(result.current.shortcuts).toBeTruthy();
      });

      // Create a mock Monaco editor element
      const monacoEditor = document.createElement('div');
      monacoEditor.className = 'monaco-editor';
      document.body.appendChild(monacoEditor);

      const inputElement = document.createElement('textarea');
      monacoEditor.appendChild(inputElement);

      // Simulate cmd+s keypress inside Monaco editor
      const event = new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, 'target', {
        value: inputElement,
        writable: false,
      });

      document.dispatchEvent(event);

      // Verify that saveFile was called
      expect(saveFileHandler).toHaveBeenCalledTimes(1);

      // Cleanup
      document.body.removeChild(monacoEditor);
    });

    it('should trigger fileSearch (cmd+f) when inside Monaco Editor', async () => {
      const fileSearchHandler = vi.fn();

      const { result } = renderHook(() =>
        useGlobalShortcuts({
          fileSearch: fileSearchHandler,
        })
      );

      // Wait for shortcuts to load
      await vi.waitFor(() => {
        expect(result.current.shortcuts).toBeTruthy();
      });

      // Create a mock Monaco editor element
      const monacoEditor = document.createElement('div');
      monacoEditor.className = 'monaco-editor';
      document.body.appendChild(monacoEditor);

      const inputElement = document.createElement('textarea');
      monacoEditor.appendChild(inputElement);

      // Simulate cmd+f keypress inside Monaco editor
      const event = new KeyboardEvent('keydown', {
        key: 'f',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, 'target', {
        value: inputElement,
        writable: false,
      });

      document.dispatchEvent(event);

      // Verify that fileSearch was called
      expect(fileSearchHandler).toHaveBeenCalledTimes(1);

      // Cleanup
      document.body.removeChild(monacoEditor);
    });
  });

  describe('Regular input fields', () => {
    it('should NOT trigger globalFileSearch when inside regular input field', async () => {
      const globalFileSearchHandler = vi.fn();

      const { result } = renderHook(() =>
        useGlobalShortcuts({
          globalFileSearch: globalFileSearchHandler,
        })
      );

      // Wait for shortcuts to load
      await vi.waitFor(() => {
        expect(result.current.shortcuts).toBeTruthy();
      });

      // Create a regular input element
      const inputElement = document.createElement('input');
      inputElement.type = 'text';
      document.body.appendChild(inputElement);

      // Simulate cmd+o keypress inside input
      const event = new KeyboardEvent('keydown', {
        key: 'o',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, 'target', {
        value: inputElement,
        writable: false,
      });

      document.dispatchEvent(event);

      // Verify that globalFileSearch was NOT called (blocked by input field check)
      expect(globalFileSearchHandler).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(inputElement);
    });
  });

  describe('Outside input fields', () => {
    it('should trigger globalFileSearch (cmd+o) outside input fields', async () => {
      const globalFileSearchHandler = vi.fn();

      const { result } = renderHook(() =>
        useGlobalShortcuts({
          globalFileSearch: globalFileSearchHandler,
        })
      );

      // Wait for shortcuts to load
      await vi.waitFor(() => {
        expect(result.current.shortcuts).toBeTruthy();
      });

      // Simulate cmd+o keypress on body
      const event = new KeyboardEvent('keydown', {
        key: 'o',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, 'target', {
        value: document.body,
        writable: false,
      });

      document.dispatchEvent(event);

      // Verify that globalFileSearch was called
      expect(globalFileSearchHandler).toHaveBeenCalledTimes(1);
    });
  });
});
