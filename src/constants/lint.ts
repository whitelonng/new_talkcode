// Lint service configuration constants
export const LINT_DEBOUNCE_DELAY = 1000;
export const LINT_CACHE_DURATION = 5000;
export const LINT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Supported languages for linting (based on Biome support)
export const LINT_SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'jsx',
  'tsx',
  'json',
  'jsonc',
  'css',
  'html',
] as const;

// Supported languages with display info for settings UI
export const LINT_SUPPORTED_LANGUAGES_DISPLAY = [
  { name: 'TypeScript', extensions: '.ts, .tsx' },
  { name: 'JavaScript', extensions: '.js, .jsx' },
  { name: 'JSON', extensions: '.json, .jsonc' },
  { name: 'CSS', extensions: '.css' },
  { name: 'HTML', extensions: '.html' },
] as const;

// Default lint settings
export const DEFAULT_LINT_SETTINGS = {
  enabled: true,
  showErrors: true,
  showWarnings: true,
  showInfo: false,
  delay: LINT_DEBOUNCE_DELAY,
  autoFixEnabled: false,
  showInProblemsPanel: true,
  showInEditor: true,
  enableBiomeIntegration: true,
} as const;

// Severity levels (labels are translation keys, used with t.Lint[key])
export const LINT_SEVERITY_LEVELS = {
  error: {
    labelKey: 'error',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    priority: 3,
  },
  warning: {
    labelKey: 'warning',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    priority: 2,
  },
  info: {
    labelKey: 'info',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    priority: 1,
  },
} as const;

// Common diagnostic codes (keys for translation lookup in t.Lint.diagnosticCodes)
export const DIAGNOSTIC_CODES = [
  'no-unused-variables',
  'no-unused-imports',
  'use-const',
  'prefer-const',
  'no-explicit-any',
  'no-empty-function',
  'no-console',
  'no-debugger',
  'no-alert',
  'eqeqeq',
  'curly',
  'no-unused-expressions',
  'prefer-arrow-callback',
  'no-var',
] as const;

// Panel configuration
export const LINT_PANEL_CONFIG = {
  defaultSize: 25,
  minSize: 20,
  maxSize: 50,
  position: 'right' as const,
} as const;

// Editor markers configuration
export const MONACO_MARKER_CONFIG = {
  owner: 'biome',
  useSeparateFormatter: true,
  stickiness: 1, // TriggersWhenChanged
} as const;
