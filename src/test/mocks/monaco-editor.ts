// Mock implementation of monaco-editor for tests
// This file is aliased in vitest.config.ts to bypass monaco-editor's ESM resolution issues

export const editor = {
  create: () => ({
    dispose: () => {},
    getValue: () => '',
    setValue: () => {},
    onDidChangeModelContent: () => ({ dispose: () => {} }),
  }),
  createModel: () => ({
    dispose: () => {},
    getValue: () => '',
    setValue: () => {},
  }),
  getModel: () => null,
  setModelMarkers: () => {},
  setTheme: () => {},
  defineTheme: () => {},
  registerEditorOpener: () => ({ dispose: () => {} }),
};

export const languages = {
  typescript: {
    typescriptDefaults: {
      setDiagnosticsOptions: () => {},
      setCompilerOptions: () => {},
    },
    javascriptDefaults: {
      setDiagnosticsOptions: () => {},
      setCompilerOptions: () => {},
    },
    ScriptTarget: { ES2020: 7 },
    ModuleResolutionKind: { NodeJs: 2 },
    ModuleKind: { ESNext: 99 },
    JsxEmit: { React: 2, ReactJSX: 4 },
  },
  registerDefinitionProvider: () => ({ dispose: () => {} }),
  registerReferenceProvider: () => ({ dispose: () => {} }),
  registerLinkProvider: () => ({ dispose: () => {} }),
  registerInlineCompletionsProvider: () => ({ dispose: () => {} }),
  CompletionItemKind: {
    Text: 0,
    Method: 1,
    Function: 2,
    Constructor: 3,
    Field: 4,
    Variable: 5,
    Class: 6,
    Interface: 7,
    Module: 8,
    Property: 9,
    Unit: 10,
    Value: 11,
    Enum: 12,
    Keyword: 13,
    Snippet: 14,
    Color: 15,
    File: 16,
    Reference: 17,
    Folder: 18,
  },
};

export const MarkerSeverity = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
};

export const Uri = {
  parse: (uri: string) => ({ toString: () => uri }),
  file: (path: string) => ({ toString: () => `file://${path}` }),
};

export default { editor, languages, MarkerSeverity, Uri };
