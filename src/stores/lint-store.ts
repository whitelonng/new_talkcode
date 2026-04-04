import { create } from 'zustand';
import type { LintDiagnostic } from '@/services/lint-service';

export interface LintSettings {
  enabled: boolean;
  showErrors: boolean;
  showWarnings: boolean;
  showInfo: boolean;
  delay: number;
  autoFixEnabled: boolean;
  showInProblemsPanel: boolean;
  showInEditor: boolean;
  enableBiomeIntegration: boolean;
}

export interface FileDiagnostics {
  filePath: string;
  diagnostics: LintDiagnostic[];
  lastUpdated: number;
  isLoading: boolean;
  error?: string;
}

interface LintState {
  // Settings
  settings: LintSettings;
  updateSettings: (settings: Partial<LintSettings>) => void;

  // File diagnostics
  fileDiagnostics: Map<string, FileDiagnostics>;
  setFileDiagnostics: (filePath: string, diagnostics: LintDiagnostic[]) => void;
  setFileDiagnosticsLoading: (filePath: string, loading: boolean) => void;
  setFileDiagnosticsError: (filePath: string, error?: string) => void;
  clearFileDiagnostics: (filePath: string) => void;
  getFileDiagnostics: (filePath: string) => FileDiagnostics | undefined;

  // Global state
  totalDiagnostics: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  updateCounts: () => void;

  // Quick fix state
  selectedDiagnostic: string | null;
  setSelectedDiagnostic: (diagnosticId: string | null) => void;

  // Panel state
  isProblemsPanelOpen: boolean;
  toggleProblemsPanel: () => void;
  setProblemsPanelOpen: (open: boolean) => void;
}

const defaultSettings: LintSettings = {
  enabled: true,
  showErrors: true,
  showWarnings: true,
  showInfo: false,
  delay: 1000,
  autoFixEnabled: false,
  showInProblemsPanel: true,
  showInEditor: true,
  enableBiomeIntegration: true,
};

/**
 * Helper function to count diagnostics by severity
 */
function countDiagnostics(diagnostics: LintDiagnostic[]): {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
} {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const diagnostic of diagnostics) {
    switch (diagnostic.severity) {
      case 'error':
        errors++;
        break;
      case 'warning':
        warnings++;
        break;
      case 'info':
        infos++;
        break;
    }
  }

  return { total: diagnostics.length, errors, warnings, infos };
}

export const useLintStore = create<LintState>((set, get) => ({
  // Settings
  settings: defaultSettings,
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  // File diagnostics
  fileDiagnostics: new Map(),
  setFileDiagnostics: (filePath, diagnostics) =>
    set((state) => {
      const newMap = new Map(state.fileDiagnostics);

      // Get old counts for this file (if any)
      const oldFileDiag = state.fileDiagnostics.get(filePath);
      const oldCounts = oldFileDiag
        ? countDiagnostics(oldFileDiag.diagnostics)
        : { total: 0, errors: 0, warnings: 0, infos: 0 };

      // Get new counts
      const newCounts = countDiagnostics(diagnostics);

      newMap.set(filePath, {
        filePath,
        diagnostics,
        lastUpdated: Date.now(),
        isLoading: false,
      });

      // Incrementally update global counts
      return {
        fileDiagnostics: newMap,
        totalDiagnostics: state.totalDiagnostics - oldCounts.total + newCounts.total,
        errorCount: state.errorCount - oldCounts.errors + newCounts.errors,
        warningCount: state.warningCount - oldCounts.warnings + newCounts.warnings,
        infoCount: state.infoCount - oldCounts.infos + newCounts.infos,
      };
    }),
  setFileDiagnosticsLoading: (filePath, loading) =>
    set((state) => {
      const newMap = new Map(state.fileDiagnostics);
      const existing = newMap.get(filePath);
      newMap.set(filePath, {
        filePath,
        diagnostics: existing?.diagnostics ?? [],
        lastUpdated: Date.now(),
        isLoading: loading,
        error: existing?.error,
      });
      return { fileDiagnostics: newMap };
    }),
  setFileDiagnosticsError: (filePath, error) =>
    set((state) => {
      const newMap = new Map(state.fileDiagnostics);
      const existing = newMap.get(filePath);
      newMap.set(filePath, {
        filePath,
        diagnostics: existing?.diagnostics ?? [],
        lastUpdated: Date.now(),
        isLoading: false,
        error,
      });
      return { fileDiagnostics: newMap };
    }),
  clearFileDiagnostics: (filePath) =>
    set((state) => {
      const newMap = new Map(state.fileDiagnostics);

      // Get old counts for this file before removing
      const oldFileDiag = state.fileDiagnostics.get(filePath);
      const oldCounts = oldFileDiag
        ? countDiagnostics(oldFileDiag.diagnostics)
        : { total: 0, errors: 0, warnings: 0, infos: 0 };

      newMap.delete(filePath);

      // Decrement global counts
      return {
        fileDiagnostics: newMap,
        totalDiagnostics: state.totalDiagnostics - oldCounts.total,
        errorCount: state.errorCount - oldCounts.errors,
        warningCount: state.warningCount - oldCounts.warnings,
        infoCount: state.infoCount - oldCounts.infos,
      };
    }),
  getFileDiagnostics: (filePath) => get().fileDiagnostics.get(filePath),

  // Global state
  totalDiagnostics: 0,
  errorCount: 0,
  warningCount: 0,
  infoCount: 0,
  updateCounts: () =>
    set((state) => {
      let total = 0;
      let errors = 0;
      let warnings = 0;
      let infos = 0;

      for (const fileDiagnostics of state.fileDiagnostics.values()) {
        for (const diagnostic of fileDiagnostics.diagnostics) {
          total++;
          switch (diagnostic.severity) {
            case 'error':
              errors++;
              break;
            case 'warning':
              warnings++;
              break;
            case 'info':
              infos++;
              break;
          }
        }
      }

      return {
        totalDiagnostics: total,
        errorCount: errors,
        warningCount: warnings,
        infoCount: infos,
      };
    }),

  // Quick fix state
  selectedDiagnostic: null,
  setSelectedDiagnostic: (diagnosticId) => set({ selectedDiagnostic: diagnosticId }),

  // Panel state
  isProblemsPanelOpen: false,
  toggleProblemsPanel: () => set((state) => ({ isProblemsPanelOpen: !state.isProblemsPanelOpen })),
  setProblemsPanelOpen: (open) => set({ isProblemsPanelOpen: open }),
}));

// Selectors for common use cases
export const useLintSettings = () => useLintStore((state) => state.settings);
export const useFileDiagnostics = (filePath: string) =>
  useLintStore((state) => state.getFileDiagnostics(filePath));
export const useLintCounts = () =>
  useLintStore((state) => ({
    total: state.totalDiagnostics,
    errors: state.errorCount,
    warnings: state.warningCount,
    infos: state.infoCount,
  }));
export const useProblemsPanelState = () => useLintStore((state) => state.isProblemsPanelOpen);
