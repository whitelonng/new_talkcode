/**
 * Tool Correctness Evaluation
 * Deterministic implementation based on DeepEval ToolCorrectnessMetric
 *
 * Evaluates whether the Agent called the correct tools to complete the task
 *
 * @example
 * ```typescript
 * const result = evaluateToolCorrectness(
 *   [{ toolCallId: 'tc-1', toolName: 'readFile', args: { path: '/test.ts' } }],
 *   ['readFile', 'grep']
 * );
 * // result.score = 0.5 (called 1 of 2 expected tools)
 * ```
 */

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolCorrectnessResult {
  /** Score 0-1 */
  score: number;
  /** Expected tools to call */
  expectedTools: string[];
  /** Actually called tools */
  actualTools: string[];
  /** Missing tools */
  missingTools: string[];
  /** Extra tools */
  extraTools: string[];
  /** Detailed report */
  details: string;
}

export interface ToolCorrectnessOptions {
  /** Whether to consider call order */
  considerOrdering?: boolean;
  /** Whether to require exact match (no extra tools allowed) */
  exactMatch?: boolean;
  /** Allowed extra tools (not counted for penalty) */
  allowedExtraTools?: string[];
}

/**
 * Evaluate tool call correctness
 *
 * Scoring rules:
 * - Base score: correctly called tools / expected tools
 * - exactMatch: if there are extra tools, deduct proportionally
 * - considerOrdering: if order is wrong, deduct 20%
 *
 * @param actualToolCalls - Actual tool call list
 * @param expectedTools - Expected tool name list
 * @param options - Evaluation options
 * @returns Evaluation result
 */
export function evaluateToolCorrectness(
  actualToolCalls: ToolCall[],
  expectedTools: string[],
  options: ToolCorrectnessOptions = {}
): ToolCorrectnessResult {
  const { considerOrdering = false, exactMatch = false, allowedExtraTools = [] } = options;

  const actualTools = actualToolCalls.map((tc) => tc.toolName);
  const missingTools = expectedTools.filter((t) => !actualTools.includes(t));
  const extraTools = actualTools.filter(
    (t) => !expectedTools.includes(t) && !allowedExtraTools.includes(t)
  );

  let score: number;

  if (expectedTools.length === 0) {
    // If no expected tools, full score as long as no wrong calls
    score = extraTools.length === 0 ? 1 : 0;
  } else {
    // Base score: proportion of correctly called tools
    const correctCalls = expectedTools.filter((t) => actualTools.includes(t)).length;
    score = correctCalls / expectedTools.length;

    // If exact match required, deduct for extra tools
    if (exactMatch && extraTools.length > 0) {
      const penalty = extraTools.length / (expectedTools.length + extraTools.length);
      score = Math.max(0, score - penalty);
    }

    // If considering order
    if (considerOrdering && score > 0) {
      const orderedCorrect = checkOrdering(actualTools, expectedTools);
      if (!orderedCorrect) {
        score *= 0.8; // 20% deduction for wrong order
      }
    }
  }

  const details = generateDetails(actualTools, expectedTools, missingTools, extraTools, score);

  return {
    score: Math.round(score * 100) / 100,
    expectedTools,
    actualTools,
    missingTools,
    extraTools,
    details,
  };
}

/**
 * Check if tool call order is correct
 * Only checks relative order of expected tools in actual calls
 */
function checkOrdering(actual: string[], expected: string[]): boolean {
  // Filter to only tools in expected list
  const filteredActual = actual.filter((t) => expected.includes(t));
  const filteredExpected = expected.filter((t) => actual.includes(t));

  // Check relative order
  for (let i = 0; i < filteredExpected.length; i++) {
    if (filteredActual[i] !== filteredExpected[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Generate detailed report
 */
function generateDetails(
  actual: string[],
  expected: string[],
  missing: string[],
  extra: string[],
  score: number
): string {
  const lines: string[] = [];
  lines.push(`Score: ${(score * 100).toFixed(0)}%`);
  lines.push(`Expected: [${expected.join(', ')}]`);
  lines.push(`Actual: [${actual.join(', ')}]`);

  if (missing.length > 0) {
    lines.push(`Missing: [${missing.join(', ')}]`);
  }
  if (extra.length > 0) {
    lines.push(`Extra: [${extra.join(', ')}]`);
  }

  return lines.join('\n');
}

/**
 * Batch evaluate tool correctness for multiple test cases
 */
export function evaluateToolCorrectnessBatch(
  cases: Array<{
    id: string;
    actualToolCalls: ToolCall[];
    expectedTools: string[];
  }>,
  options: ToolCorrectnessOptions = {}
): {
  results: Array<{ id: string; result: ToolCorrectnessResult }>;
  averageScore: number;
  passRate: number;
  passThreshold?: number;
} {
  const results = cases.map((c) => ({
    id: c.id,
    result: evaluateToolCorrectness(c.actualToolCalls, c.expectedTools, options),
  }));

  const scores = results.map((r) => r.result.score);
  const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // Default 70% as pass threshold
  const passThreshold = 0.7;
  const passedCount = scores.filter((s) => s >= passThreshold).length;
  const passRate = cases.length > 0 ? passedCount / cases.length : 0;

  return {
    results,
    averageScore: Math.round(averageScore * 100) / 100,
    passRate: Math.round(passRate * 100) / 100,
    passThreshold,
  };
}
