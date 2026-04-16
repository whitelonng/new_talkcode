import type { editor } from 'monaco-editor';
import type { ThemeVariant } from '@/lib/theme-context';
import { setupVueAsHtml } from './monaco-vue-config';

type Monaco = typeof import('monaco-editor');

// Track if diagnostics have already been disabled (global setting, only need to run once)
let diagnosticsDisabled = false;

export function setupMonacoDiagnostics(_model: editor.ITextModel | null, monacoInstance?: Monaco) {
  // Only run once - this is a global Monaco setting
  if (diagnosticsDisabled) return;

  // TypeScript worker is removed to reduce bundle size (~6MB)
  // All diagnostics are now provided by LSP (typescript-language-server)
  // We need to explicitly disable Monaco's built-in TypeScript diagnostics
  // which still run (slower) on the main thread even without the worker
  const monaco = monacoInstance || (window as { monaco?: Monaco }).monaco;
  if (!monaco) return;

  try {
    // Disable Monaco's built-in TypeScript/JavaScript validation
    // This prevents false module resolution errors from appearing
    // Use the new top-level "typescript" namespace (the old "languages.typescript" is deprecated)
    const ts = monaco.typescript;
    if (ts?.typescriptDefaults) {
      ts.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
      });
    }
    if (ts?.javascriptDefaults) {
      ts.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
      });
    }
    diagnosticsDisabled = true;
  } catch {
    // monaco.languages.typescript may not be available when worker is removed
    // This is expected and safe to ignore
  }
}

// Track if Vue language has been set up
let vueLanguageSetup = false;

/**
 * Set up Vue language syntax highlighting
 * Vue files need custom syntax highlighting for template expressions and directives
 */
export function setupVueLanguage(monacoInstance?: Monaco) {
  if (vueLanguageSetup) return;

  const monaco = monacoInstance || (window as { monaco?: Monaco }).monaco;
  if (!monaco) return;

  try {
    setupVueAsHtml(monaco);
    vueLanguageSetup = true;
  } catch (error) {
    // Vue language setup failed, fall back to default
    console.error('Failed to setup Vue language support:', error);
  }
}

/**
 * Set up custom themes for AI suggestions
 */
export function getMonacoThemeName(
  themeVariant: ThemeVariant,
  resolvedTheme: 'light' | 'dark'
): string {
  if (themeVariant === 'retroma') {
    return resolvedTheme === 'light' ? 'retroma-light-ai' : 'retroma-dark-ai';
  }

  return resolvedTheme === 'light' ? 'light-ai' : 'vs-dark-ai';
}

export function setupMonacoTheme(
  themeVariant: ThemeVariant = 'default',
  initialTheme: 'light' | 'dark' = 'dark',
  monacoInstance?: typeof import('monaco-editor')
) {
  const monaco = monacoInstance || (window as { monaco?: typeof import('monaco-editor') }).monaco;
  if (!monaco) return;

  // Define dark theme with AI suggestion colors
  monaco.editor.defineTheme('vs-dark-ai', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editorInlineSuggestion.foreground': '#666666',
      'editorInlineSuggestion.background': 'transparent',
    },
  });

  // Define light theme with AI suggestion colors
  monaco.editor.defineTheme('light-ai', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editorInlineSuggestion.foreground': '#999999',
      'editorInlineSuggestion.background': 'transparent',
    },
  });

  monaco.editor.defineTheme('retroma-light-ai', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#f5f4ef',
      'editor.foreground': '#2b231e',
      'editor.lineHighlightBackground': '#eeede533',
      'editor.selectionBackground': '#6e3a6622',
      'editor.inactiveSelectionBackground': '#6e3a6614',
      'editorCursor.foreground': '#6e3a66',
      'editorLineNumber.foreground': '#948878',
      'editorLineNumber.activeForeground': '#5a4a3a',
      'editorIndentGuide.background1': '#d8d4c8',
      'editorIndentGuide.activeBackground1': '#979d62',
      'editorSuggestWidget.background': '#faf9f6',
      'editorSuggestWidget.border': '#d8d4c8',
      'editorSuggestWidget.foreground': '#2b231e',
      'editorSuggestWidget.selectedBackground': '#f2e8f0',
      'editorWidget.background': '#faf9f6',
      'editorWidget.border': '#d8d4c8',
      'editorHoverWidget.background': '#faf9f6',
      'editorHoverWidget.border': '#d8d4c8',
      'editorInlineSuggestion.foreground': '#8c8878',
      'editorInlineSuggestion.background': 'transparent',
    },
  });

  monaco.editor.defineTheme('retroma-dark-ai', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#14140f',
      'editor.foreground': '#e8e6d8',
      'editor.lineHighlightBackground': '#ffffff08',
      'editor.selectionBackground': '#be80bf33',
      'editor.inactiveSelectionBackground': '#6e8ddb24',
      'editorCursor.foreground': '#d4c6fa',
      'editorLineNumber.foreground': '#6f6b5d',
      'editorLineNumber.activeForeground': '#d6d3c4',
      'editorIndentGuide.background1': '#3a3a28',
      'editorIndentGuide.activeBackground1': '#898a54',
      'editorSuggestWidget.background': '#1b1b14',
      'editorSuggestWidget.border': '#3a3a28',
      'editorSuggestWidget.foreground': '#e8e6d8',
      'editorSuggestWidget.selectedBackground': '#2f2a38',
      'editorWidget.background': '#1b1b14',
      'editorWidget.border': '#3a3a28',
      'editorHoverWidget.background': '#1b1b14',
      'editorHoverWidget.border': '#3a3a28',
      'editorInlineSuggestion.foreground': '#8c877c',
      'editorInlineSuggestion.background': 'transparent',
    },
  });

  // Set initial theme
  const theme = getMonacoThemeName(themeVariant, initialTheme);
  monaco.editor.setTheme(theme);
}

/**
 * Clean up AI completion text
 */
export function cleanAICompletion(completion: string): string {
  let cleanCompletion = completion.trim();

  // Remove code block markers
  cleanCompletion = cleanCompletion.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');

  // Remove excessive leading whitespace while preserving relative indentation
  const lines = cleanCompletion.split('\n');
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

  if (nonEmptyLines.length > 0) {
    const minIndent = nonEmptyLines.reduce((min, line) => {
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      return Math.min(min, indent);
    }, Number.POSITIVE_INFINITY);

    if (minIndent > 0 && minIndent !== Number.POSITIVE_INFINITY) {
      cleanCompletion = lines
        .map((line) => (line.length > minIndent ? line.slice(minIndent) : line))
        .join('\n');
    }
  }

  return cleanCompletion;
}

/**
 * Check if changes should trigger AI completion
 */
export function shouldTriggerAICompletion(
  model: editor.ITextModel,
  position: { lineNumber: number; column: number },
  changes: editor.IModelContentChange[],
  isAICompleting: boolean
): boolean {
  // Never trigger if we're currently getting a completion
  if (isAICompleting) return false;

  // // Never trigger if user is actively typing (to avoid conflicts)
  // if (isUserTyping) return false;

  // Check if changes look like meaningful additions
  let meaningfulAddition = false;
  for (const change of changes) {
    const changeText = change.text;

    // Skip empty changes
    if (!changeText) continue;

    // Skip single characters that aren't meaningful
    if (changeText.length === 1 && /\s/.test(changeText)) continue;

    // Look for meaningful content
    if (changeText.length > 1 || /[a-zA-Z0-9_.(){}[\]=:]/.test(changeText)) {
      meaningfulAddition = true;
      break;
    }
  }

  if (!meaningfulAddition) return false;

  // Get the current line content for context
  const currentLine = model.getLineContent(position.lineNumber);
  const beforeCursor = currentLine.substring(0, position.column - 1);

  // Only trigger if we have some substantial content
  if (beforeCursor.trim().length < 3) return false;

  // Trigger conditions: meaningful content additions at word boundaries
  const lastChar = beforeCursor[beforeCursor.length - 1];
  if (!lastChar) return false;
  const triggerChars = ['.', '(', '=', ':', '{', '[', ' ', ';', ')', '}', ']', ','];

  return triggerChars.includes(lastChar) || position.column === currentLine.length + 1; // End of line
}

/**
 * Format timestamp for display
 */
export function formatLastSavedTime(time: Date): string {
  return time.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
