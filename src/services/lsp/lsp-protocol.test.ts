import { describe, expect, it } from 'vitest';
import {
  DiagnosticSeverity,
  filePathToUri,
  severityToString,
  uriToFilePath,
} from './lsp-protocol';

describe('lsp-protocol: filePathToUri', () => {
  it('should convert Unix absolute path to file URI', () => {
    const result = filePathToUri('/home/user/project/file.ts');
    expect(result).toBe('file:///home/user/project/file.ts');
  });

  it('should convert Windows path to file URI', () => {
    const result = filePathToUri('C:\\Users\\user\\project\\file.ts');
    expect(result).toBe('file:///C:/Users/user/project/file.ts');
  });

  it('should handle paths with spaces', () => {
    const result = filePathToUri('/home/user/my project/file.ts');
    expect(result).toBe('file:///home/user/my%20project/file.ts');
  });

  it('should handle paths with special characters', () => {
    const result = filePathToUri('/home/user/project/file (1).ts');
    expect(result).toBe('file:///home/user/project/file%20(1).ts');
  });

  it('should return already valid file URI unchanged', () => {
    const uri = 'file:///home/user/project/file.ts';
    const result = filePathToUri(uri);
    expect(result).toBe(uri);
  });

  it('should handle paths with unicode characters', () => {
    const result = filePathToUri('/home/user/项目/文件.ts');
    expect(result).toContain('file:///home/user/');
    // Should encode unicode characters
    expect(result).not.toContain('项目');
  });
});

describe('lsp-protocol: uriToFilePath', () => {
  it('should convert file URI to Unix path', () => {
    const result = uriToFilePath('file:///home/user/project/file.ts');
    expect(result).toBe('/home/user/project/file.ts');
  });

  it('should convert file URI with Windows path', () => {
    const result = uriToFilePath('file:///C:/Users/user/project/file.ts');
    expect(result).toBe('C:/Users/user/project/file.ts');
  });

  it('should decode URI-encoded spaces', () => {
    const result = uriToFilePath('file:///home/user/my%20project/file.ts');
    expect(result).toBe('/home/user/my project/file.ts');
  });

  it('should decode URI-encoded special characters', () => {
    const result = uriToFilePath('file:///home/user/project/file%20(1).ts');
    expect(result).toBe('/home/user/project/file (1).ts');
  });

  it('should return non-file URI unchanged', () => {
    const path = '/home/user/project/file.ts';
    const result = uriToFilePath(path);
    expect(result).toBe(path);
  });

  it('should handle empty string', () => {
    const result = uriToFilePath('');
    expect(result).toBe('');
  });

  it('should decode unicode characters', () => {
    const result = uriToFilePath('file:///home/user/%E9%A1%B9%E7%9B%AE/file.ts');
    expect(result).toBe('/home/user/项目/file.ts');
  });
});

describe('lsp-protocol: roundtrip conversion', () => {
  it('should preserve path through filePathToUri -> uriToFilePath', () => {
    const originalPath = '/home/user/project/file.ts';
    const uri = filePathToUri(originalPath);
    const result = uriToFilePath(uri);
    expect(result).toBe(originalPath);
  });

  it('should preserve path with spaces through roundtrip', () => {
    const originalPath = '/home/user/my project/file.ts';
    const uri = filePathToUri(originalPath);
    const result = uriToFilePath(uri);
    expect(result).toBe(originalPath);
  });

  it('should preserve Windows path through roundtrip', () => {
    const originalPath = 'C:/Users/user/project/file.ts';
    // Windows paths with forward slashes
    const uri = filePathToUri(originalPath);
    const result = uriToFilePath(uri);
    expect(result).toBe(originalPath);
  });
});

describe('lsp-protocol: severityToString', () => {
  it('should convert Error severity', () => {
    const result = severityToString(DiagnosticSeverity.Error);
    expect(result).toBe('error');
  });

  it('should convert Warning severity', () => {
    const result = severityToString(DiagnosticSeverity.Warning);
    expect(result).toBe('warning');
  });

  it('should convert Information severity', () => {
    const result = severityToString(DiagnosticSeverity.Information);
    expect(result).toBe('info');
  });

  it('should convert Hint severity', () => {
    const result = severityToString(DiagnosticSeverity.Hint);
    expect(result).toBe('hint');
  });

  it('should default to info for unknown severity', () => {
    // @ts-expect-error Testing invalid input
    const result = severityToString(99);
    expect(result).toBe('info');
  });
});
