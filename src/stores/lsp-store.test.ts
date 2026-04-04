import { beforeEach, describe, expect, it } from 'vitest';
import { DiagnosticSeverity } from '@/services/lsp/lsp-protocol';
import { useLspStore } from './lsp-store';

describe('lsp-store: diagnostics', () => {
  beforeEach(() => {
    // Reset the store before each test
    useLspStore.setState({
      diagnosticsByFile: new Map(),
      diagnosticsCounts: { errors: 0, warnings: 0, info: 0, hints: 0 },
      showErrors: true,
      showWarnings: true,
      showInfo: true,
      showHints: true,
    });
  });

  describe('setDiagnostics', () => {
    it('should set diagnostics for a file', () => {
      const { setDiagnostics, getDiagnostics } = useLspStore.getState();

      setDiagnostics('file:///test/file.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error message',
          severity: DiagnosticSeverity.Error,
        },
      ]);

      const diagnostics = getDiagnostics('/test/file.ts');
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Error message');
      expect(diagnostics[0].severity).toBe('error');
    });

    it('should update counts correctly when adding diagnostics', () => {
      const { setDiagnostics, diagnosticsCounts } = useLspStore.getState();

      setDiagnostics('file:///test/file.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error 1',
          severity: DiagnosticSeverity.Error,
        },
        {
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: 'Warning 1',
          severity: DiagnosticSeverity.Warning,
        },
        {
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } },
          message: 'Info 1',
          severity: DiagnosticSeverity.Information,
        },
      ]);

      const counts = useLspStore.getState().diagnosticsCounts;
      expect(counts.errors).toBe(1);
      expect(counts.warnings).toBe(1);
      expect(counts.info).toBe(1);
      expect(counts.hints).toBe(0);
    });

    it('should update counts using delta when replacing diagnostics', () => {
      const { setDiagnostics } = useLspStore.getState();

      // Add initial diagnostics
      setDiagnostics('file:///test/file.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error 1',
          severity: DiagnosticSeverity.Error,
        },
        {
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: 'Error 2',
          severity: DiagnosticSeverity.Error,
        },
      ]);

      let counts = useLspStore.getState().diagnosticsCounts;
      expect(counts.errors).toBe(2);

      // Replace with fewer errors
      useLspStore.getState().setDiagnostics('file:///test/file.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error 1',
          severity: DiagnosticSeverity.Error,
        },
      ]);

      counts = useLspStore.getState().diagnosticsCounts;
      expect(counts.errors).toBe(1);
    });

    it('should handle multiple files correctly', () => {
      const { setDiagnostics } = useLspStore.getState();

      // Add diagnostics to first file
      setDiagnostics('file:///test/file1.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error in file1',
          severity: DiagnosticSeverity.Error,
        },
      ]);

      // Add diagnostics to second file
      useLspStore.getState().setDiagnostics('file:///test/file2.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error in file2',
          severity: DiagnosticSeverity.Error,
        },
        {
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: 'Warning in file2',
          severity: DiagnosticSeverity.Warning,
        },
      ]);

      const counts = useLspStore.getState().diagnosticsCounts;
      expect(counts.errors).toBe(2);
      expect(counts.warnings).toBe(1);
    });
  });

  describe('clearDiagnostics', () => {
    it('should clear diagnostics for a file', () => {
      const { setDiagnostics, clearDiagnostics, getDiagnostics } = useLspStore.getState();

      setDiagnostics('file:///test/file.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error message',
          severity: DiagnosticSeverity.Error,
        },
      ]);

      useLspStore.getState().clearDiagnostics('file:///test/file.ts');

      const diagnostics = useLspStore.getState().getDiagnostics('/test/file.ts');
      expect(diagnostics).toHaveLength(0);
    });

    it('should update counts correctly when clearing diagnostics', () => {
      const { setDiagnostics } = useLspStore.getState();

      setDiagnostics('file:///test/file.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error 1',
          severity: DiagnosticSeverity.Error,
        },
        {
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: 'Warning 1',
          severity: DiagnosticSeverity.Warning,
        },
      ]);

      let counts = useLspStore.getState().diagnosticsCounts;
      expect(counts.errors).toBe(1);
      expect(counts.warnings).toBe(1);

      useLspStore.getState().clearDiagnostics('file:///test/file.ts');

      counts = useLspStore.getState().diagnosticsCounts;
      expect(counts.errors).toBe(0);
      expect(counts.warnings).toBe(0);
    });

    it('should not affect other files when clearing', () => {
      const { setDiagnostics } = useLspStore.getState();

      setDiagnostics('file:///test/file1.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error in file1',
          severity: DiagnosticSeverity.Error,
        },
      ]);

      useLspStore.getState().setDiagnostics('file:///test/file2.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error in file2',
          severity: DiagnosticSeverity.Error,
        },
      ]);

      useLspStore.getState().clearDiagnostics('file:///test/file1.ts');

      const counts = useLspStore.getState().diagnosticsCounts;
      expect(counts.errors).toBe(1);

      const file2Diagnostics = useLspStore.getState().getDiagnostics('/test/file2.ts');
      expect(file2Diagnostics).toHaveLength(1);
    });

    it('should handle clearing non-existent file', () => {
      const initialCounts = useLspStore.getState().diagnosticsCounts;

      useLspStore.getState().clearDiagnostics('file:///test/nonexistent.ts');

      const counts = useLspStore.getState().diagnosticsCounts;
      expect(counts).toEqual(initialCounts);
    });
  });

  describe('clearAllDiagnostics', () => {
    it('should clear all diagnostics', () => {
      const { setDiagnostics } = useLspStore.getState();

      setDiagnostics('file:///test/file1.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error 1',
          severity: DiagnosticSeverity.Error,
        },
      ]);

      useLspStore.getState().setDiagnostics('file:///test/file2.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error 2',
          severity: DiagnosticSeverity.Error,
        },
      ]);

      useLspStore.getState().clearAllDiagnostics();

      const counts = useLspStore.getState().diagnosticsCounts;
      expect(counts.errors).toBe(0);
      expect(counts.warnings).toBe(0);
      expect(counts.info).toBe(0);
      expect(counts.hints).toBe(0);

      expect(useLspStore.getState().getDiagnostics('/test/file1.ts')).toHaveLength(0);
      expect(useLspStore.getState().getDiagnostics('/test/file2.ts')).toHaveLength(0);
    });
  });

  describe('filtering', () => {
    it('should filter out errors when showErrors is false', () => {
      useLspStore.setState({ showErrors: false });

      const { setDiagnostics } = useLspStore.getState();
      setDiagnostics('file:///test/file.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Error',
          severity: DiagnosticSeverity.Error,
        },
        {
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: 'Warning',
          severity: DiagnosticSeverity.Warning,
        },
      ]);

      const diagnostics = useLspStore.getState().getDiagnostics('/test/file.ts');
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe('warning');
    });

    it('should filter out hints when showHints is false', () => {
      useLspStore.setState({ showHints: false });

      const { setDiagnostics } = useLspStore.getState();
      setDiagnostics('file:///test/file.ts', [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message: 'Hint',
          severity: DiagnosticSeverity.Hint,
        },
        {
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
          message: 'Info',
          severity: DiagnosticSeverity.Information,
        },
      ]);

      const diagnostics = useLspStore.getState().getDiagnostics('/test/file.ts');
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe('info');
    });
  });
});

describe('lsp-store: pending downloads', () => {
  beforeEach(() => {
    useLspStore.setState({ pendingDownloads: [] });
  });

  it('should add pending download', () => {
    const { addPendingDownload } = useLspStore.getState();

    addPendingDownload({
      language: 'rust',
      languageDisplayName: 'Rust',
      serverName: 'rust-analyzer',
    });

    const pending = useLspStore.getState().pendingDownloads;
    expect(pending).toHaveLength(1);
    expect(pending[0].language).toBe('rust');
  });

  it('should not add duplicate pending download', () => {
    const { addPendingDownload } = useLspStore.getState();

    addPendingDownload({
      language: 'rust',
      languageDisplayName: 'Rust',
      serverName: 'rust-analyzer',
    });

    useLspStore.getState().addPendingDownload({
      language: 'rust',
      languageDisplayName: 'Rust',
      serverName: 'rust-analyzer',
    });

    const pending = useLspStore.getState().pendingDownloads;
    expect(pending).toHaveLength(1);
  });

  it('should remove pending download', () => {
    const { addPendingDownload } = useLspStore.getState();

    addPendingDownload({
      language: 'rust',
      languageDisplayName: 'Rust',
      serverName: 'rust-analyzer',
    });

    useLspStore.getState().removePendingDownload('rust');

    const pending = useLspStore.getState().pendingDownloads;
    expect(pending).toHaveLength(0);
  });

  it('should clear all pending downloads', () => {
    const { addPendingDownload } = useLspStore.getState();

    addPendingDownload({
      language: 'rust',
      languageDisplayName: 'Rust',
      serverName: 'rust-analyzer',
    });

    useLspStore.getState().addPendingDownload({
      language: 'python',
      languageDisplayName: 'Python',
      serverName: 'pyright',
    });

    useLspStore.getState().clearPendingDownloads();

    const pending = useLspStore.getState().pendingDownloads;
    expect(pending).toHaveLength(0);
  });
});
