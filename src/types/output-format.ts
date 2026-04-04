// src/types/output-format.ts

export type OutputFormatType = 'markdown' | 'mermaid' | 'web' | 'ppt';

export const OUTPUT_FORMAT_OPTIONS: ReadonlyArray<OutputFormatType> = [
  'markdown',
  'mermaid',
  'web',
  'ppt',
];

export const DEFAULT_OUTPUT_FORMAT: OutputFormatType = 'markdown';
