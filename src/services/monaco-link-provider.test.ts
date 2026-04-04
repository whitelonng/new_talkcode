import { describe, expect, it } from 'vitest';
import { extractGoImportMatches } from './monaco-link-provider';

describe('extractGoImportMatches', () => {
  it('matches single-line imports with optional alias', () => {
    const content = [
      'package main',
      'import "fmt"',
      'import alias "example.com/foo"',
      'import _ "example.com/blank"',
      'import . "example.com/dot"',
    ].join('\n');

    const matches = extractGoImportMatches(content).map((m) => m.importPath);
    expect(matches).toEqual([
      'fmt',
      'example.com/foo',
      'example.com/blank',
      'example.com/dot',
    ]);
  });

  it('matches imports inside blocks only', () => {
    const content = [
      'package main',
      'import (',
      '  "fmt"',
      '  alias "example.com/foo"',
      ')',
    ].join('\n');

    const matches = extractGoImportMatches(content).map((m) => m.importPath);
    expect(matches).toEqual(['fmt', 'example.com/foo']);
  });

  it('does not match non-import string literals', () => {
    const content = [
      'package main',
      'const example = "not-an-import"',
      'func main() {',
      '  println("still not import")',
      '}',
    ].join('\n');

    const matches = extractGoImportMatches(content).map((m) => m.importPath);
    expect(matches).toEqual([]);
  });
});
