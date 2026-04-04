/**
 * Golden Dataset Evaluator
 * Evaluates Agent behavior using predefined test case sets
 *
 * @example
 * ```typescript
 * const goldenCases: GoldenCase[] = [
 *   {
 *     id: 'search-todo',
 *     input: 'Find all TODO comments',
 *     expectedTools: ['grep'],
 *     expectedOutputContains: ['TODO'],
 *   },
 * ];
 *
 * const report = await runGoldenEvaluation(runAgent, goldenCases);
 * console.log(`Pass rate: ${report.passRate * 100}%`);
 * ```
 */

import { evaluateStepEfficiency, type TraceStep } from './metrics/step-efficiency';
import { evaluateToolCorrectness, type ToolCall } from './metrics/tool-correctness';
import type { AgentTrace } from './trace-recorder';

// ============================================
// Type Definitions
// ============================================

export interface GoldenCase {
  /** Case ID */
  id: string;
  /** User input */
  input: string;
  /** Expected tool list to call */
  expectedTools?: string[];
  /** Expected text to contain in output */
  expectedOutputContains?: string[];
  /** Expected text not to contain in output */
  expectedOutputNotContains?: string[];
  /** Expected regex patterns to match in output */
  expectedOutputMatches?: RegExp[];
  /** Expected minimum number of steps */
  expectedMinSteps?: number;
  /** Expected maximum number of steps */
  expectedMaxSteps?: number;
  /** Category tags */
  tags?: string[];
  /** Case description */
  description?: string;
  /** Whether to skip */
  skip?: boolean;
}

export interface EvaluationScores {
  toolCorrectness?: number;
  stepEfficiency?: number;
  outputMatch?: number;
}

export interface EvaluationResult {
  /** Case ID */
  caseId: string;
  /** User input */
  input: string;
  /** Whether passed */
  passed: boolean;
  /** Scores for each dimension */
  scores: EvaluationScores;
  /** Detailed information */
  details: string[];
  /** Complete trace */
  trace?: AgentTrace;
  /** Execution time (ms) */
  duration?: number;
  /** Error message */
  error?: string;
}

export interface EvaluationReport {
  /** Total number of cases */
  totalCases: number;
  /** Number of passed cases */
  passedCases: number;
  /** Pass rate */
  passRate: number;
  /** Average scores */
  averageScores: {
    toolCorrectness: number;
    stepEfficiency: number;
    outputMatch: number;
    overall: number;
  };
  /** Results for each case */
  results: EvaluationResult[];
  /** Statistics grouped by tag */
  byTag?: Record<string, { passed: number; total: number; passRate: number }>;
  /** Evaluation timestamp */
  timestamp: string;
  /** Total duration (ms) */
  totalDuration: number;
}

export interface EvaluationOptions {
  /** Pass threshold (0-1), default 0.7 */
  passThreshold?: number;
  /** Whether to stop on failure */
  stopOnFailure?: boolean;
  /** Single case timeout (ms), default 30000 */
  timeout?: number;
  /** Whether to include trace details */
  includeTrace?: boolean;
  /** Progress callback */
  onProgress?: (completed: number, total: number, result: EvaluationResult) => void;
  /** Only run cases with specified tags */
  filterTags?: string[];
  /** Skip cases with specified tags */
  skipTags?: string[];
}

// ============================================
// Core Evaluation Functions
// ============================================

/**
 * Run Golden Dataset evaluation
 *
 * @param runAgent - Agent execution function
 * @param goldenCases - Golden test cases
 * @param options - Evaluation options
 * @returns Evaluation report
 */
export async function runGoldenEvaluation(
  runAgent: (input: string) => Promise<AgentTrace>,
  goldenCases: GoldenCase[],
  options: EvaluationOptions = {}
): Promise<EvaluationReport> {
  const {
    passThreshold = 0.7,
    stopOnFailure = false,
    timeout = 30000,
    includeTrace = false,
    onProgress,
    filterTags,
    skipTags,
  } = options;

  const startTime = Date.now();
  const results: EvaluationResult[] = [];
  const scoreArrays = {
    toolCorrectness: [] as number[],
    stepEfficiency: [] as number[],
    outputMatch: [] as number[],
    overall: [] as number[],
  };

  // Filter cases
  const casesToRun = filterCases(goldenCases, filterTags, skipTags);

  for (let i = 0; i < casesToRun.length; i++) {
    const goldenCase = casesToRun[i];

    if (goldenCase.skip) {
      continue;
    }

    const caseStartTime = Date.now();

    try {
      const trace = await Promise.race([
        runAgent(goldenCase.input),
        createTimeoutPromise<AgentTrace>(timeout, `Case '${goldenCase.id}' timed out`),
      ]);

      const result = evaluateCase(goldenCase, trace, passThreshold, includeTrace);
      result.duration = Date.now() - caseStartTime;
      results.push(result);

      // Collect scores
      if (result.scores.toolCorrectness !== undefined) {
        scoreArrays.toolCorrectness.push(result.scores.toolCorrectness);
      }
      if (result.scores.stepEfficiency !== undefined) {
        scoreArrays.stepEfficiency.push(result.scores.stepEfficiency);
      }
      if (result.scores.outputMatch !== undefined) {
        scoreArrays.outputMatch.push(result.scores.outputMatch);
      }

      // Calculate overall score
      const overallScore = calculateOverallScore(result.scores);
      scoreArrays.overall.push(overallScore);

      // Progress callback
      onProgress?.(i + 1, casesToRun.length, result);

      if (stopOnFailure && !result.passed) {
        break;
      }
    } catch (error) {
      const result: EvaluationResult = {
        caseId: goldenCase.id,
        input: goldenCase.input,
        passed: false,
        scores: {},
        details: [],
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - caseStartTime,
      };
      results.push(result);

      onProgress?.(i + 1, casesToRun.length, result);

      if (stopOnFailure) break;
    }
  }

  const passedCases = results.filter((r) => r.passed).length;

  return {
    totalCases: casesToRun.length,
    passedCases,
    passRate: casesToRun.length > 0 ? Math.round((passedCases / casesToRun.length) * 100) / 100 : 0,
    averageScores: {
      toolCorrectness: average(scoreArrays.toolCorrectness),
      stepEfficiency: average(scoreArrays.stepEfficiency),
      outputMatch: average(scoreArrays.outputMatch),
      overall: average(scoreArrays.overall),
    },
    results,
    byTag: calculateTagStats(goldenCases, results),
    timestamp: new Date().toISOString(),
    totalDuration: Date.now() - startTime,
  };
}

// ============================================
// Internal Helper Functions
// ============================================

/**
 * Evaluate a single case
 */
function evaluateCase(
  goldenCase: GoldenCase,
  trace: AgentTrace,
  passThreshold: number,
  includeTrace: boolean
): EvaluationResult {
  const scores: EvaluationScores = {};
  const details: string[] = [];
  const scoreWeights: number[] = [];

  // Evaluate tool correctness
  if (goldenCase.expectedTools && goldenCase.expectedTools.length > 0) {
    const toolCalls = extractToolCalls(trace);
    const toolResult = evaluateToolCorrectness(toolCalls, goldenCase.expectedTools);
    scores.toolCorrectness = toolResult.score;
    details.push(`Tool Correctness: ${(toolResult.score * 100).toFixed(0)}%`);
    details.push(`  ${toolResult.details.split('\n').join('\n  ')}`);
    scoreWeights.push(toolResult.score);
  }

  // Evaluate step efficiency
  if (goldenCase.expectedMinSteps !== undefined || goldenCase.expectedMaxSteps !== undefined) {
    const stepResult = evaluateStepEfficiency(trace.steps as TraceStep[], {
      expectedMinSteps: goldenCase.expectedMinSteps,
    });
    scores.stepEfficiency = stepResult.score;
    details.push(`Step Efficiency: ${(stepResult.score * 100).toFixed(0)}%`);
    details.push(`  ${stepResult.details.split('\n').join('\n  ')}`);
    scoreWeights.push(stepResult.score);

    // Check maximum steps
    if (goldenCase.expectedMaxSteps !== undefined) {
      if (stepResult.actualSteps > goldenCase.expectedMaxSteps) {
        scores.stepEfficiency = Math.max(0, scores.stepEfficiency - 0.3);
        details.push(
          `  Warning: Exceeded max steps (${stepResult.actualSteps} > ${goldenCase.expectedMaxSteps})`
        );
      }
    }
  }

  // Evaluate output match
  const outputScore = evaluateOutputMatch(trace.output, goldenCase);
  if (outputScore !== null) {
    scores.outputMatch = outputScore.score;
    details.push(`Output Match: ${(outputScore.score * 100).toFixed(0)}%`);
    for (const detail of outputScore.details) {
      details.push(`  ${detail}`);
    }
    scoreWeights.push(outputScore.score);
  }

  // Calculate overall score
  const overallScore =
    scoreWeights.length > 0 ? scoreWeights.reduce((a, b) => a + b, 0) / scoreWeights.length : 1;

  return {
    caseId: goldenCase.id,
    input: goldenCase.input,
    passed: overallScore >= passThreshold,
    scores,
    details,
    trace: includeTrace ? trace : undefined,
  };
}

/**
 * Evaluate output match
 */
function evaluateOutputMatch(
  output: string,
  goldenCase: GoldenCase
): { score: number; details: string[] } | null {
  const checks: { passed: boolean; detail: string }[] = [];

  // Check required text to contain
  if (goldenCase.expectedOutputContains && goldenCase.expectedOutputContains.length > 0) {
    for (const text of goldenCase.expectedOutputContains) {
      const found = output.includes(text);
      checks.push({
        passed: found,
        detail: found ? `✓ Contains "${truncate(text, 30)}"` : `✗ Missing "${truncate(text, 30)}"`,
      });
    }
  }

  // Check text that must not be contained
  if (goldenCase.expectedOutputNotContains && goldenCase.expectedOutputNotContains.length > 0) {
    for (const text of goldenCase.expectedOutputNotContains) {
      const found = output.includes(text);
      checks.push({
        passed: !found,
        detail: !found
          ? `✓ Does not contain "${truncate(text, 30)}"`
          : `✗ Unexpectedly contains "${truncate(text, 30)}"`,
      });
    }
  }

  // Check regex matches
  if (goldenCase.expectedOutputMatches && goldenCase.expectedOutputMatches.length > 0) {
    for (const pattern of goldenCase.expectedOutputMatches) {
      const matched = pattern.test(output);
      checks.push({
        passed: matched,
        detail: matched ? `✓ Matches pattern ${pattern}` : `✗ Does not match pattern ${pattern}`,
      });
    }
  }

  if (checks.length === 0) {
    return null;
  }

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    score: passedCount / checks.length,
    details: checks.map((c) => c.detail),
  };
}

/**
 * Extract tool calls from trace
 */
function extractToolCalls(trace: AgentTrace): ToolCall[] {
  return trace.steps
    .filter((s) => s.type === 'tool-call')
    .map((s, index) => {
      const data = s.data as {
        toolName: string;
        args: Record<string, unknown>;
        toolCallId?: string;
      };
      return {
        toolCallId: data.toolCallId ?? `tc-${index}`,
        toolName: data.toolName,
        args: data.args,
      };
    });
}

/**
 * Filter cases
 */
function filterCases(
  cases: GoldenCase[],
  filterTags?: string[],
  skipTags?: string[]
): GoldenCase[] {
  return cases.filter((c) => {
    // Skip cases marked as skip
    if (c.skip) return false;

    // If filterTags is specified, only run matching cases
    if (filterTags && filterTags.length > 0) {
      if (!c.tags || !c.tags.some((t) => filterTags.includes(t))) {
        return false;
      }
    }

    // Skip cases in skipTags
    if (skipTags && skipTags.length > 0) {
      if (c.tags?.some((t) => skipTags.includes(t))) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculate statistics grouped by tag
 */
function calculateTagStats(
  cases: GoldenCase[],
  results: EvaluationResult[]
): Record<string, { passed: number; total: number; passRate: number }> {
  const stats: Record<string, { passed: number; total: number }> = {};

  for (const c of cases) {
    if (!c.tags) continue;
    for (const tag of c.tags) {
      if (!stats[tag]) {
        stats[tag] = { passed: 0, total: 0 };
      }
      stats[tag].total++;

      const result = results.find((r) => r.caseId === c.id);
      if (result?.passed) {
        stats[tag].passed++;
      }
    }
  }

  const result: Record<string, { passed: number; total: number; passRate: number }> = {};
  for (const [tag, stat] of Object.entries(stats)) {
    result[tag] = {
      ...stat,
      passRate: stat.total > 0 ? Math.round((stat.passed / stat.total) * 100) / 100 : 0,
    };
  }

  return result;
}

/**
 * Calculate overall score
 */
function calculateOverallScore(scores: EvaluationScores): number {
  const values = Object.values(scores).filter((v) => v !== undefined) as number[];
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 1;
}

/**
 * Calculate average
 */
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
}

/**
 * Truncate string
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

/**
 * Create timeout Promise
 */
function createTimeoutPromise<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

// ============================================
// Report Generation
// ============================================

/**
 * Generate text summary of evaluation report
 */
export function generateReportSummary(report: EvaluationReport): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════',
    '           Golden Dataset Evaluation Report        ',
    '═══════════════════════════════════════════════════',
    '',
    `Timestamp: ${report.timestamp}`,
    `Duration: ${report.totalDuration}ms`,
    '',
    '📊 Summary',
    '───────────────────────────────────────────────────',
    `Total Cases: ${report.totalCases}`,
    `Passed: ${report.passedCases}`,
    `Failed: ${report.totalCases - report.passedCases}`,
    `Pass Rate: ${(report.passRate * 100).toFixed(1)}%`,
    '',
    '📈 Average Scores',
    '───────────────────────────────────────────────────',
    `Tool Correctness: ${(report.averageScores.toolCorrectness * 100).toFixed(1)}%`,
    `Step Efficiency: ${(report.averageScores.stepEfficiency * 100).toFixed(1)}%`,
    `Output Match: ${(report.averageScores.outputMatch * 100).toFixed(1)}%`,
    `Overall: ${(report.averageScores.overall * 100).toFixed(1)}%`,
  ];

  if (report.byTag && Object.keys(report.byTag).length > 0) {
    lines.push('');
    lines.push('🏷️  By Tag');
    lines.push('───────────────────────────────────────────────────');
    for (const [tag, stat] of Object.entries(report.byTag)) {
      lines.push(`${tag}: ${stat.passed}/${stat.total} (${(stat.passRate * 100).toFixed(1)}%)`);
    }
  }

  const failedResults = report.results.filter((r) => !r.passed);
  if (failedResults.length > 0) {
    lines.push('');
    lines.push('❌ Failed Cases');
    lines.push('───────────────────────────────────────────────────');
    for (const result of failedResults) {
      lines.push(`• ${result.caseId}: ${result.error ?? 'Score below threshold'}`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}
