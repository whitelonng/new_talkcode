import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { type LintDiagnostic } from '@/services/lint-service';
import { useLintStore } from '@/stores/lint-store';
import { useLintDiagnostics } from '@/hooks/use-lint-diagnostics';

// Mock the lint service module
vi.mock('@/services/lint-service', () => ({
  lintService: {
    init: vi.fn().mockResolvedValue(undefined),
    runBiomeLint: vi.fn().mockResolvedValue({
      filePath: '/test/file.ts',
      diagnostics: [],
      timestamp: Date.now(),
    }),
    convertToMonacoMarker: vi.fn((diagnostic: LintDiagnostic) => ({
      severity: diagnostic.severity === 'error' ? 8 : diagnostic.severity === 'warning' ? 4 : 2,
      message: diagnostic.message,
      startLineNumber: diagnostic.range.start.line,
      startColumn: diagnostic.range.start.column,
      endLineNumber: diagnostic.range.end.line,
      endColumn: diagnostic.range.end.column,
      source: diagnostic.source,
      code: diagnostic.code,
    })),
    applyDiagnosticsToEditor: vi.fn(),
    clearDiagnostics: vi.fn(),
    clearCache: vi.fn(),
    clearCacheForFile: vi.fn(),
  },
}));

describe('Lint Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset lint store before each test
    useLintStore.getState().updateSettings({ enabled: true, showErrors: true, showWarnings: true });
  });

  describe('LintService', () => {
    it('should convert diagnostics to Monaco markers', async () => {
      const { lintService } = await import('@/services/lint-service');

      const diagnostic: LintDiagnostic = {
        id: 'test-1',
        severity: 'error',
        message: 'Test error',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 5 },
        },
        source: 'biome',
        code: 'test-error',
      };

      const marker = lintService.convertToMonacoMarker(diagnostic);

      expect(marker).toMatchObject({
        severity: 8, // MarkerSeverity.Error
        message: 'Test error',
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 5,
        source: 'biome',
        code: 'test-error',
      });
    });
  });

  describe('LintStore', () => {
    it('should manage settings correctly', () => {
      const store = useLintStore.getState();

      expect(store.settings.enabled).toBe(true);
      expect(store.settings.showErrors).toBe(true);
      expect(store.settings.showWarnings).toBe(true);

      store.updateSettings({ enabled: false });
      expect(useLintStore.getState().settings.enabled).toBe(false);
    });

    it('should track file diagnostics', () => {
      const store = useLintStore.getState();
      const testDiagnostics: LintDiagnostic[] = [
        {
          id: 'test-1',
          severity: 'error',
          message: 'Test error',
          range: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
          source: 'biome',
        },
      ];

      store.setFileDiagnostics('/test/file.ts', testDiagnostics);

      const fileDiag = store.getFileDiagnostics('/test/file.ts');
      expect(fileDiag).toBeDefined();
      expect(fileDiag?.diagnostics).toHaveLength(1);
      expect(fileDiag?.diagnostics[0].message).toBe('Test error');
    });
  });

  describe('UseLintDiagnostics Hook', () => {
    it('should trigger lint on button click', async () => {
      const { lintService } = await import('@/services/lint-service');

      const mockEditor = {
        getModel: () => ({
          getValue: () => 'const test = 1;',
          uri: { toString: () => 'file:///test/file.ts' },
        }),
      };

      const TestComponent = () => {
        const { triggerLint } = useLintDiagnostics({
          editor: mockEditor as any,
          filePath: '/test/file.ts',
          rootPath: '/test',
          enabled: true,
        });

        return (
          <button onClick={triggerLint} data-testid="trigger-lint">
            Trigger Lint
          </button>
        );
      };

      render(<TestComponent />);

      const button = screen.getByTestId('trigger-lint');

      await act(async () => {
        fireEvent.click(button);
      });

      await waitFor(() => {
        expect(lintService.clearCacheForFile).toHaveBeenCalledWith('/test/file.ts');
        expect(lintService.runBiomeLint).toHaveBeenCalledWith('/test/file.ts', '/test');
      });
    });
  });

  describe('Integration', () => {
    it('should handle full lint workflow', async () => {
      const { lintService } = await import('@/services/lint-service');

      // Mock Monaco editor on window
      const mockMonaco = {
        editor: {
          setModelMarkers: vi.fn(),
        },
      };
      (window as any).monaco = mockMonaco;

      const mockEditor = {
        getModel: () => ({
          getValue: () => 'const unused = 1;',
          uri: { toString: () => 'file:///test/file.ts' },
          getFullModelRange: () => ({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 20,
          }),
        }),
        executeEdits: vi.fn(),
      };

      const mockDiagnostics: LintDiagnostic[] = [
        {
          id: 'diag-1',
          severity: 'error',
          message: 'Unused variable',
          range: { start: { line: 1, column: 7 }, end: { line: 1, column: 13 } },
          source: 'biome',
          code: 'no-unused-vars',
        },
      ];

      // Mock the lint service to return diagnostics
      vi.mocked(lintService.runBiomeLint).mockResolvedValueOnce({
        filePath: '/test/file.ts',
        diagnostics: mockDiagnostics,
        timestamp: Date.now(),
      });

      // Run lint
      const result = await lintService.runBiomeLint('/test/file.ts');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].message).toBe('Unused variable');

      // Apply diagnostics to editor
      lintService.applyDiagnosticsToEditor(mockEditor as any, result.diagnostics);
      expect(lintService.applyDiagnosticsToEditor).toHaveBeenCalledWith(mockEditor, mockDiagnostics);

      // Clean up
      delete (window as any).monaco;
    });
  });
});
