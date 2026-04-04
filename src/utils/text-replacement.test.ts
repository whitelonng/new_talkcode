import { describe, expect, it } from 'vitest';
import {
  findSimilarText,
  fuzzyMatch,
  normalizeString,
  safeLiteralReplace,
  smartMatch,
  smartNormalizeString,
} from './text-replacement';

describe('Text Replacement Utils', () => {
  describe('safeLiteralReplace', () => {
    it('should replace first occurrence by default', () => {
      const content = 'hello world hello';
      const result = safeLiteralReplace(content, 'hello', 'hi');
      expect(result).toEqual({ result: 'hi world hello', occurrences: 1 });
    });

    it('should replace all occurrences when replaceAll is true', () => {
      const content = 'hello world hello';
      const result = safeLiteralReplace(content, 'hello', 'hi', true);
      expect(result).toEqual({ result: 'hi world hi', occurrences: 2 });
    });

    it('should return original content when no match found', () => {
      const content = 'hello world';
      const result = safeLiteralReplace(content, 'foo', 'bar');
      expect(result).toEqual({ result: 'hello world', occurrences: 0 });
    });
  });

  describe('normalizeString', () => {
    it('should normalize Windows line endings', () => {
      const result = normalizeString('line1\r\nline2\r\nline3');
      expect(result).toBe('line1\nline2\nline3');
    });

    it('should normalize Mac line endings', () => {
      const result = normalizeString('line1\rline2\rline3');
      expect(result).toBe('line1\nline2\nline3');
    });

    it('should leave Unix line endings unchanged', () => {
      const result = normalizeString('line1\nline2\nline3');
      expect(result).toBe('line1\nline2\nline3');
    });
  });

  describe('smartNormalizeString', () => {
    it('should convert literal \\n to actual newlines when appropriate', () => {
      const input = 'line1\\nline2\\nline3';
      const result = smartNormalizeString(input);
      expect(result).toBe('line1\nline2\nline3');
    });

    it('should not convert \\n when there are already many actual newlines', () => {
      const input = 'line1\nline2\nline3\\nsome text';
      const result = smartNormalizeString(input);
      expect(result).toBe('line1\nline2\nline3\\nsome text');
    });

    it('should handle mixed line endings and escaped newlines', () => {
      const input = 'line1\\nline2\r\nline3\\n';
      const result = smartNormalizeString(input);
      expect(result).toBe('line1\nline2\nline3\n');
    });
  });

  describe('fuzzyMatch', () => {
    it('should find exact matches', () => {
      const content = 'function test() {\n  return true;\n}';
      const search = 'function test()';
      const result = fuzzyMatch(content, search);
      expect(result.found).toBe(true);
    });

    it('should detect indentation differences', () => {
      const content = '  function test() {\n    return true;\n  }';
      const search = 'function test() {\n  return true;\n}';
      const result = fuzzyMatch(content, search);
      expect(result.found).toBe(false);
      expect(result.suggestion).toContain('different indentation');
    });

    it('should return no match for completely different text', () => {
      const content = 'function test() { return true; }';
      const search = 'function other() { return false; }';
      const result = fuzzyMatch(content, search);
      expect(result.found).toBe(false);
      expect(result.suggestion).toBeUndefined();
    });
  });

  describe('smartMatch', () => {
    it('should perform exact match first', () => {
      const content = 'function test() {\n  return true;\n}';
      const search = 'function test()';
      const result = smartMatch(content, search);
      expect(result.matchType).toBe('exact');
      expect(result.occurrences).toBe(1);
    });

    it('should use smart normalization for escaped newlines', () => {
      const content = 'function test() {\n  return true;\n}';
      const search = 'function test() {\\n  return true;\\n}';
      const result = smartMatch(content, search);
      expect(result.matchType).toBe('smart');
      expect(result.occurrences).toBe(1);
      expect(result.correctedOldString).toBe('function test() {\n  return true;\n}');
    });

    it('should handle whitespace differences', () => {
      const content = '  function test() {\n    return true;\n  }';
      const search = 'function test() {\n  return true;\n}';
      const result = smartMatch(content, search);
      expect(result.matchType).toBe('smart');
      expect(result.occurrences).toBe(1);
      expect(result.correctedOldString).toBe('  function test() {\n    return true;\n  }');
    });

    it('should return none when no match is possible', () => {
      const content = 'function test() { return true; }';
      const search = 'function other() { return false; }';
      const result = smartMatch(content, search);
      expect(result.matchType).toBe('none');
      expect(result.occurrences).toBe(0);
    });
  });

  describe('findSimilarText', () => {
    it('should find similar text with context', () => {
      const content = 'line1\nfunction test() {\nline3\nline4\nline5';
      const search = 'function test() {';
      const results = findSimilarText(content, search);
      expect(results).toHaveLength(1);
      expect(results[0]).toContain('Near line 2');
      expect(results[0]).toContain('function test()');
    });

    it('should return empty array when no similar text found', () => {
      const content = 'line1\nline2\nline3';
      const search = 'completely different text';
      const results = findSimilarText(content, search);
      expect(results).toHaveLength(0);
    });

    it('should limit results to maxResults', () => {
      const content = 'test\ntest\ntest\ntest\ntest';
      const search = 'test';
      const results = findSimilarText(content, search, 2);
      expect(results).toHaveLength(2);
    });
  });
});
