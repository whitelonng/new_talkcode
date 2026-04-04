// src/services/lsp/lsp-protocol.ts
// LSP (Language Server Protocol) type definitions

// ============================================================================
// JSON-RPC Base Types
// ============================================================================

export interface JsonRpcMessage {
  jsonrpc: '2.0';
}

export interface JsonRpcRequest extends JsonRpcMessage {
  id: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification extends JsonRpcMessage {
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse extends JsonRpcMessage {
  id: number | string | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// LSP Position and Range
// ============================================================================

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface LocationLink {
  originSelectionRange?: Range;
  targetUri: string;
  targetRange: Range;
  targetSelectionRange: Range;
}

// ============================================================================
// LSP Text Document
// ============================================================================

export interface TextDocumentIdentifier {
  uri: string;
}

export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  version: number;
}

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

export interface TextDocumentContentChangeEvent {
  range?: Range;
  rangeLength?: number;
  text: string;
}

// ============================================================================
// LSP Diagnostics
// ============================================================================

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export interface DiagnosticRelatedInformation {
  location: Location;
  message: string;
}

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: number | string;
  codeDescription?: { href: string };
  source?: string;
  message: string;
  tags?: number[];
  relatedInformation?: DiagnosticRelatedInformation[];
  data?: unknown;
}

export interface PublishDiagnosticsParams {
  uri: string;
  version?: number;
  diagnostics: Diagnostic[];
}

// ============================================================================
// LSP Hover
// ============================================================================

export interface MarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}

export interface Hover {
  contents: MarkupContent | string | { language: string; value: string }[];
  range?: Range;
}

// ============================================================================
// LSP Completion
// ============================================================================

export enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export interface CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: string | MarkupContent;
  deprecated?: boolean;
  preselect?: boolean;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  insertTextFormat?: number;
  textEdit?: { range: Range; newText: string };
  additionalTextEdits?: { range: Range; newText: string }[];
  commitCharacters?: string[];
  command?: { title: string; command: string; arguments?: unknown[] };
  data?: unknown;
}

export interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

// ============================================================================
// LSP Definition / References
// ============================================================================

export type Definition = Location | Location[] | LocationLink[];

export interface ReferenceContext {
  includeDeclaration: boolean;
}

export interface ReferenceParams extends TextDocumentPositionParams {
  context: ReferenceContext;
}

// ============================================================================
// LSP Document Symbols
// ============================================================================

export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}

export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: SymbolKind;
  tags?: number[];
  deprecated?: boolean;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

export interface SymbolInformation {
  name: string;
  kind: SymbolKind;
  tags?: number[];
  deprecated?: boolean;
  location: Location;
  containerName?: string;
}

// ============================================================================
// LSP Call Hierarchy
// ============================================================================

export interface CallHierarchyItem {
  name: string;
  kind: SymbolKind;
  tags?: number[];
  detail?: string;
  uri: string;
  range: Range;
  selectionRange: Range;
  data?: unknown;
}

export interface CallHierarchyIncomingCall {
  from: CallHierarchyItem;
  fromRanges: Range[];
}

export interface CallHierarchyOutgoingCall {
  to: CallHierarchyItem;
  fromRanges: Range[];
}

// ============================================================================
// LSP Initialize
// ============================================================================

export interface ClientCapabilities {
  textDocument?: {
    synchronization?: {
      dynamicRegistration?: boolean;
      willSave?: boolean;
      willSaveWaitUntil?: boolean;
      didSave?: boolean;
    };
    completion?: {
      dynamicRegistration?: boolean;
      completionItem?: {
        snippetSupport?: boolean;
        commitCharactersSupport?: boolean;
        documentationFormat?: string[];
        deprecatedSupport?: boolean;
        preselectSupport?: boolean;
      };
      completionItemKind?: { valueSet?: number[] };
      contextSupport?: boolean;
    };
    hover?: {
      dynamicRegistration?: boolean;
      contentFormat?: string[];
    };
    definition?: {
      dynamicRegistration?: boolean;
      linkSupport?: boolean;
    };
    implementation?: {
      dynamicRegistration?: boolean;
      linkSupport?: boolean;
    };
    references?: {
      dynamicRegistration?: boolean;
    };
    documentSymbol?: {
      dynamicRegistration?: boolean;
      symbolKind?: { valueSet?: number[] };
      hierarchicalDocumentSymbolSupport?: boolean;
    };
    callHierarchy?: {
      dynamicRegistration?: boolean;
    };
    publishDiagnostics?: {
      relatedInformation?: boolean;
      tagSupport?: { valueSet?: number[] };
      versionSupport?: boolean;
      codeDescriptionSupport?: boolean;
      dataSupport?: boolean;
    };
  };
  workspace?: {
    workspaceFolders?: boolean;
    configuration?: boolean;
    symbol?: {
      dynamicRegistration?: boolean;
    };
  };
}

export interface InitializeParams {
  processId: number | null;
  clientInfo?: { name: string; version?: string };
  rootUri: string | null;
  rootPath?: string | null;
  capabilities: ClientCapabilities;
  initializationOptions?: unknown;
  workspaceFolders?: { uri: string; name: string }[] | null;
}

export interface ServerCapabilities {
  textDocumentSync?:
    | number
    | {
        openClose?: boolean;
        change?: number;
        save?: boolean | { includeText?: boolean };
      };
  completionProvider?: {
    triggerCharacters?: string[];
    resolveProvider?: boolean;
  };
  hoverProvider?: boolean;
  definitionProvider?: boolean;
  referencesProvider?: boolean;
  documentSymbolProvider?: boolean;
  workspaceSymbolProvider?: boolean;
  codeActionProvider?: boolean;
  documentFormattingProvider?: boolean;
  renameProvider?: boolean;
}

export interface InitializeResult {
  capabilities: ServerCapabilities;
  serverInfo?: { name: string; version?: string };
}

// ============================================================================
// LSP Methods
// ============================================================================

export const LSP_METHODS = {
  // Lifecycle
  INITIALIZE: 'initialize',
  INITIALIZED: 'initialized',
  SHUTDOWN: 'shutdown',
  EXIT: 'exit',

  // Text Document
  DID_OPEN: 'textDocument/didOpen',
  DID_CHANGE: 'textDocument/didChange',
  DID_SAVE: 'textDocument/didSave',
  DID_CLOSE: 'textDocument/didClose',

  // Language Features
  HOVER: 'textDocument/hover',
  COMPLETION: 'textDocument/completion',
  DEFINITION: 'textDocument/definition',
  IMPLEMENTATION: 'textDocument/implementation',
  REFERENCES: 'textDocument/references',
  DOCUMENT_SYMBOL: 'textDocument/documentSymbol',
  WORKSPACE_SYMBOL: 'workspace/symbol',
  CALL_HIERARCHY_PREPARE: 'textDocument/prepareCallHierarchy',
  CALL_HIERARCHY_INCOMING: 'callHierarchy/incomingCalls',
  CALL_HIERARCHY_OUTGOING: 'callHierarchy/outgoingCalls',

  // Diagnostics (Server -> Client)
  PUBLISH_DIAGNOSTICS: 'textDocument/publishDiagnostics',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

export function filePathToUri(filePath: string): string {
  // Convert file path to file:// URI
  if (filePath.startsWith('file://')) {
    return filePath;
  }
  // Normalize path separators to forward slashes
  let normalizedPath = filePath.replace(/\\/g, '/');
  // Encode special characters but preserve path separators
  // Split by /, encode each segment, then rejoin
  const segments = normalizedPath.split('/');
  const encodedSegments = segments.map((segment) =>
    encodeURIComponent(segment).replace(/%3A/gi, ':')
  );
  normalizedPath = encodedSegments.join('/');
  // Handle Windows paths
  if (/^[a-zA-Z]:/.test(filePath)) {
    return `file:///${normalizedPath}`;
  }
  return `file://${normalizedPath}`;
}

export function uriToFilePath(uri: string): string {
  if (!uri.startsWith('file://')) {
    return uri;
  }
  let path = uri.slice(7);
  // Handle Windows paths (file:///C:/...)
  if (/^\/[a-zA-Z]:/.test(path)) {
    path = path.slice(1);
  }
  // Decode URI-encoded characters (e.g., %20 -> space)
  return decodeURIComponent(path);
}

export function severityToString(
  severity: DiagnosticSeverity
): 'error' | 'warning' | 'info' | 'hint' {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return 'error';
    case DiagnosticSeverity.Warning:
      return 'warning';
    case DiagnosticSeverity.Information:
      return 'info';
    case DiagnosticSeverity.Hint:
      return 'hint';
    default:
      return 'info';
  }
}
