// Auto-save delay in milliseconds (2 seconds)
export const AUTO_SAVE_DELAY = 2000;

// Typing detection timeout (1.5 seconds)
export const TYPING_TIMEOUT = 1500;

// AI completion debounce delay (200ms)
export const AI_COMPLETION_DELAY = 200;

// AI completion expiration time (30 seconds)
export const AI_COMPLETION_EXPIRY = 30_000;

// Monaco editor options
export const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  lineNumbers: 'on' as const,
  renderWhitespace: 'selection' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on' as const,
  folding: true,
  bracketPairColorization: { enabled: true },
  renderLineHighlight: 'line' as const,
  cursorBlinking: 'smooth' as const,
  smoothScrolling: true,
  'semanticHighlighting.enabled': true,
  inlineSuggest: {
    enabled: true,
    showToolbar: 'onHover' as const,
  },
  suggest: {
    preview: true,
    showInlineDetails: true,
  },
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  glyphMargin: true,
  lineDecorationsWidth: 10,
  hover: { enabled: true },
  parameterHints: { enabled: true },
  acceptSuggestionOnEnter: 'off' as const,
  // Enable Cmd+Click to go to definition
  gotoLocation: {
    multiple: 'goto' as const,
    multipleDefinitions: 'goto' as const,
    multipleTypeDefinitions: 'goto' as const,
    multipleDeclarations: 'goto' as const,
    multipleImplementations: 'goto' as const,
    multipleReferences: 'peek' as const,
  },
  // Enable definition link on Cmd+hover
  definitionLinkOpensInPeek: false,
  // Enable find/search functionality
  find: {
    seedSearchStringFromSelection: 'always' as const,
    autoFindInSelection: 'never' as const,
    globalFindClipboard: false,
    addExtraSpaceOnTop: true,
  },
  // Use Alt+Click for multi-cursor, so Cmd+Click can trigger Go to Definition
  multiCursorModifier: 'alt' as const,
  // Enable diagnostics display
  rulers: undefined as undefined,
  showFoldingControls: 'always' as const,
  // Enable code lens for diagnostics
  codeLens: true,
  // Enable lightbulb for quick fixes
  lightbulb: undefined as undefined,
} as const;
