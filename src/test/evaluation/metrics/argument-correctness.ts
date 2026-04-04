/**
 * Tool Argument Correctness Evaluation
 * Evaluates whether the Agent passed correct arguments when calling tools
 *
 * @example
 * ```typescript
 * const result = evaluateArgumentCorrectness(
 *   { toolName: 'readFile', args: { path: '/test.ts', encoding: 'utf-8' } },
 *   { path: '/test.ts' }
 * );
 * // result.score = 1.0 (all expected args matched)
 * ```
 */

export interface ArgumentCorrectnessResult {
  /** Score 0-1 */
  score: number;
  /** Tool name */
  toolName: string;
  /** Expected arguments */
  expectedArgs: Record<string, unknown>;
  /** Actual arguments */
  actualArgs: Record<string, unknown>;
  /** Matched argument keys */
  matchedKeys: string[];
  /** Missing argument keys */
  missingKeys: string[];
  /** Incorrect value argument keys */
  incorrectKeys: string[];
  /** Detailed report */
  details: string;
}

export interface ArgumentCorrectnessOptions {
  /** Whether to perform deep comparison (default true) */
  deepCompare?: boolean;
  /** Argument keys to ignore */
  ignoreKeys?: string[];
  /** Allowed value variants mapping (key -> list of allowed values) */
  valueAliases?: Record<string, unknown[]>;
  /** Whether to allow extra arguments (default true) */
  allowExtraArgs?: boolean;
  /** Custom comparison function */
  customComparator?: (key: string, actual: unknown, expected: unknown) => boolean;
}

/**
 * Evaluate argument correctness for a single tool call
 *
 * @param toolCall - Actual tool call
 * @param expectedArgs - Expected arguments
 * @param options - Evaluation options
 * @returns Evaluation result
 */
export function evaluateArgumentCorrectness(
  toolCall: { toolName: string; args: Record<string, unknown> },
  expectedArgs: Record<string, unknown>,
  options: ArgumentCorrectnessOptions = {}
): ArgumentCorrectnessResult {
  const { deepCompare = true, ignoreKeys = [], valueAliases = {}, customComparator } = options;

  const actualArgs = toolCall.args;
  const expectedKeys = Object.keys(expectedArgs).filter((k) => !ignoreKeys.includes(k));

  const matchedKeys: string[] = [];
  const missingKeys: string[] = [];
  const incorrectKeys: string[] = [];

  for (const key of expectedKeys) {
    if (!(key in actualArgs)) {
      missingKeys.push(key);
      continue;
    }

    const expectedValue = expectedArgs[key];
    const actualValue = actualArgs[key];

    // Use custom comparator
    if (customComparator) {
      if (customComparator(key, actualValue, expectedValue)) {
        matchedKeys.push(key);
      } else {
        incorrectKeys.push(key);
      }
      continue;
    }

    // Standard comparison
    if (isValueMatch(actualValue, expectedValue, valueAliases[key], deepCompare)) {
      matchedKeys.push(key);
    } else {
      incorrectKeys.push(key);
    }
  }

  const score = expectedKeys.length === 0 ? 1 : matchedKeys.length / expectedKeys.length;

  return {
    score: Math.round(score * 100) / 100,
    toolName: toolCall.toolName,
    expectedArgs,
    actualArgs,
    matchedKeys,
    missingKeys,
    incorrectKeys,
    details: generateArgDetails(
      toolCall.toolName,
      matchedKeys,
      missingKeys,
      incorrectKeys,
      score,
      expectedArgs,
      actualArgs
    ),
  };
}

/**
 * Check if values match
 */
function isValueMatch(
  actual: unknown,
  expected: unknown,
  aliases?: unknown[],
  deep = true
): boolean {
  // Check aliases
  if (aliases?.some((alias) => isEqual(actual, alias, deep))) {
    return true;
  }

  return isEqual(actual, expected, deep);
}

/**
 * Deep compare two values for equality
 */
function isEqual(a: unknown, b: unknown, deep: boolean): boolean {
  if (a === b) return true;

  // Handle null/undefined
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  // Deep compare objects and arrays
  if (deep && typeof a === 'object' && typeof b === 'object') {
    // Array comparison
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => isEqual(item, b[index], deep));
    }

    // Object comparison
    if (!Array.isArray(a) && !Array.isArray(b)) {
      const aKeys = Object.keys(a as Record<string, unknown>);
      const bKeys = Object.keys(b as Record<string, unknown>);

      if (aKeys.length !== bKeys.length) return false;

      return aKeys.every((key) =>
        isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], deep)
      );
    }
  }

  return false;
}

/**
 * Generate detailed report for argument evaluation
 */
function generateArgDetails(
  toolName: string,
  matched: string[],
  missing: string[],
  incorrect: string[],
  score: number,
  expectedArgs: Record<string, unknown>,
  actualArgs: Record<string, unknown>
): string {
  const lines = [`Tool: ${toolName}`, `Score: ${(score * 100).toFixed(0)}%`];

  if (matched.length > 0) {
    lines.push(`Matched: [${matched.join(', ')}]`);
  }
  if (missing.length > 0) {
    lines.push(`Missing: [${missing.join(', ')}]`);
    for (const key of missing) {
      lines.push(`  - ${key}: expected ${JSON.stringify(expectedArgs[key])}`);
    }
  }
  if (incorrect.length > 0) {
    lines.push(`Incorrect: [${incorrect.join(', ')}]`);
    for (const key of incorrect) {
      lines.push(
        `  - ${key}: expected ${JSON.stringify(expectedArgs[key])}, got ${JSON.stringify(actualArgs[key])}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Evaluate argument correctness for multiple tool calls
 */
export function evaluateMultipleArgumentCorrectness(
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>,
  expectedArgsMap: Record<string, Record<string, unknown>>,
  options: ArgumentCorrectnessOptions = {}
): {
  results: ArgumentCorrectnessResult[];
  averageScore: number;
  allMatched: boolean;
} {
  const results: ArgumentCorrectnessResult[] = [];

  for (const toolCall of toolCalls) {
    const expectedArgs = expectedArgsMap[toolCall.toolName];
    if (expectedArgs) {
      results.push(evaluateArgumentCorrectness(toolCall, expectedArgs, options));
    }
  }

  const scores = results.map((r) => r.score);
  const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
  const allMatched = results.every((r) => r.score === 1);

  return {
    results,
    averageScore: Math.round(averageScore * 100) / 100,
    allMatched,
  };
}

/**
 * Create commonly used argument matchers
 */
export const argMatchers = {
  /** Path matching - ignores leading slash differences */
  pathEquals: (actual: unknown, expected: unknown): boolean => {
    if (typeof actual !== 'string' || typeof expected !== 'string') return false;
    return actual.replace(/^\/+/, '') === expected.replace(/^\/+/, '');
  },

  /** Contains matching - checks if actual value contains expected value */
  contains: (actual: unknown, expected: unknown): boolean => {
    if (typeof actual !== 'string' || typeof expected !== 'string') return false;
    return actual.includes(expected);
  },

  /** Regex matching */
  matchesPattern:
    (pattern: RegExp) =>
    (actual: unknown): boolean => {
      if (typeof actual !== 'string') return false;
      return pattern.test(actual);
    },

  /** Array contains all expected elements */
  arrayContainsAll: (actual: unknown, expected: unknown): boolean => {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
    return expected.every((item) => actual.includes(item));
  },
};
