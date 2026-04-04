/**
 * Agent Step Efficiency Evaluation
 * Evaluates whether the Agent used the minimum necessary steps to complete the task
 *
 * @example
 * ```typescript
 * const result = evaluateStepEfficiency(steps, {
 *   expectedMinSteps: 3,
 * });
 * // result.score = 1.0 if actualSteps <= 3
 * // result.score = 0.75 if actualSteps = 4 (3/4)
 * ```
 */

export interface TraceStep {
  type: string;
  toolName?: string;
  args?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StepEfficiencyResult {
  /** Score 0-1 */
  score: number;
  /** Actual number of steps */
  actualSteps: number;
  /** Expected minimum steps */
  expectedMinSteps: number;
  /** Detected redundant patterns */
  redundantPatterns: string[];
  /** Detailed report */
  details: string;
}

export interface RedundantPattern {
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Detection function */
  detect: (steps: TraceStep[]) => boolean;
  /** Severity level (affects penalty ratio) */
  severity?: 'low' | 'medium' | 'high';
}

export interface StepEfficiencyOptions {
  /** Expected minimum steps */
  expectedMinSteps?: number;
  /** Custom redundant pattern detectors */
  redundantPatterns?: RedundantPattern[];
  /** Whether to use default redundant patterns */
  useDefaultPatterns?: boolean;
  /** Penalty ratio for each redundant pattern */
  redundancyPenalty?: number;
}

/**
 * Default redundant pattern detectors
 */
export const defaultRedundantPatterns: RedundantPattern[] = [
  {
    name: 'duplicate-read',
    description: 'Reading the same file multiple times',
    severity: 'medium',
    detect: (steps: TraceStep[]) => {
      const reads = steps.filter((s) => s.toolName === 'readFile');
      const paths = reads.map((r) => (r.args as { path?: string })?.path).filter(Boolean);
      return new Set(paths).size < paths.length;
    },
  },
  {
    name: 'unnecessary-glob-before-grep',
    description: 'Unnecessary glob call before grep',
    severity: 'low',
    detect: (steps: TraceStep[]) => {
      const toolSequence = steps
        .filter((s) => s.type === 'tool-call')
        .map((s) => s.toolName)
        .filter(Boolean);

      for (let i = 0; i < toolSequence.length - 1; i++) {
        if (toolSequence[i] === 'glob' && toolSequence[i + 1] === 'grep') {
          return true;
        }
      }
      return false;
    },
  },
  {
    name: 'repeated-tool-call',
    description: 'Calling the same tool more than 2 times consecutively (possibly stuck)',
    severity: 'high',
    detect: (steps: TraceStep[]) => {
      const toolCalls = steps.filter((s) => s.type === 'tool-call');
      for (let i = 0; i < toolCalls.length - 2; i++) {
        if (
          toolCalls[i].toolName === toolCalls[i + 1].toolName &&
          toolCalls[i + 1].toolName === toolCalls[i + 2].toolName
        ) {
          return true;
        }
      }
      return false;
    },
  },
  {
    name: 'write-then-read-same-file',
    description: 'Reading the same file immediately after writing to it',
    severity: 'low',
    detect: (steps: TraceStep[]) => {
      const toolCalls = steps.filter((s) => s.type === 'tool-call');
      for (let i = 0; i < toolCalls.length - 1; i++) {
        const current = toolCalls[i];
        const next = toolCalls[i + 1];

        if (
          (current.toolName === 'writeFile' || current.toolName === 'editFile') &&
          next.toolName === 'readFile'
        ) {
          const writePath = (current.args as { path?: string })?.path;
          const readPath = (next.args as { path?: string })?.path;
          if (writePath && readPath && writePath === readPath) {
            return true;
          }
        }
      }
      return false;
    },
  },
  {
    name: 'excessive-tool-calls',
    description: 'Tool calls exceed 10 times',
    severity: 'medium',
    detect: (steps: TraceStep[]) => {
      const toolCalls = steps.filter((s) => s.type === 'tool-call');
      return toolCalls.length > 10;
    },
  },
];

/**
 * Evaluate step efficiency
 */
export function evaluateStepEfficiency(
  steps: TraceStep[],
  options: StepEfficiencyOptions = {}
): StepEfficiencyResult {
  const {
    expectedMinSteps,
    redundantPatterns = [],
    useDefaultPatterns = true,
    redundancyPenalty = 0.15,
  } = options;

  const allPatterns = useDefaultPatterns
    ? [...defaultRedundantPatterns, ...redundantPatterns]
    : redundantPatterns;

  const toolCallSteps = steps.filter((s) => s.type === 'tool-call');
  const actualSteps = toolCallSteps.length;

  // Detect redundant patterns
  const detectedPatterns = allPatterns
    .filter((pattern) => pattern.detect(steps))
    .map((p) => p.name);

  let score: number;

  if (expectedMinSteps !== undefined) {
    // If expected steps provided, calculate based on ratio
    if (actualSteps === 0) {
      score = expectedMinSteps === 0 ? 1 : 0;
    } else {
      score = Math.min(1, expectedMinSteps / actualSteps);
    }
  } else {
    // Score based on redundancy detection
    score = 1;
  }

  // Deduct points for redundant patterns
  if (detectedPatterns.length > 0) {
    const severityMultipliers: Record<string, number> = {
      low: 0.5,
      medium: 1,
      high: 1.5,
    };

    let totalPenalty = 0;
    for (const patternName of detectedPatterns) {
      const pattern = allPatterns.find((p) => p.name === patternName);
      const multiplier = severityMultipliers[pattern?.severity ?? 'medium'];
      totalPenalty += redundancyPenalty * multiplier;
    }

    score = Math.max(0, score - totalPenalty);
  }

  return {
    score: Math.round(score * 100) / 100,
    actualSteps,
    expectedMinSteps: expectedMinSteps ?? actualSteps,
    redundantPatterns: detectedPatterns,
    details: generateDetails(actualSteps, expectedMinSteps, detectedPatterns, score),
  };
}

/**
 * Generate detailed report
 */
function generateDetails(
  actualSteps: number,
  expectedMinSteps: number | undefined,
  redundantPatterns: string[],
  score: number
): string {
  const lines = [`Score: ${(score * 100).toFixed(0)}%`, `Actual steps: ${actualSteps}`];

  if (expectedMinSteps !== undefined) {
    lines.push(`Expected min steps: ${expectedMinSteps}`);
  }

  if (redundantPatterns.length > 0) {
    lines.push(`Redundant patterns detected: [${redundantPatterns.join(', ')}]`);
  } else {
    lines.push('No redundant patterns detected');
  }

  return lines.join('\n');
}

/**
 * Analyze step sequence, return detailed step analysis
 */
export function analyzeStepSequence(steps: TraceStep[]): {
  totalSteps: number;
  toolCallCount: number;
  uniqueTools: string[];
  toolCallFrequency: Record<string, number>;
  averageTimeBetweenSteps?: number;
} {
  const toolCalls = steps.filter((s) => s.type === 'tool-call');
  const toolNames = toolCalls.map((s) => s.toolName).filter(Boolean) as string[];

  const toolCallFrequency: Record<string, number> = {};
  for (const name of toolNames) {
    toolCallFrequency[name] = (toolCallFrequency[name] ?? 0) + 1;
  }

  return {
    totalSteps: steps.length,
    toolCallCount: toolCalls.length,
    uniqueTools: [...new Set(toolNames)],
    toolCallFrequency,
  };
}

/**
 * Create custom redundant pattern detector
 */
export function createRedundantPattern(
  name: string,
  detect: (steps: TraceStep[]) => boolean,
  options: { description?: string; severity?: 'low' | 'medium' | 'high' } = {}
): RedundantPattern {
  return {
    name,
    description: options.description ?? name,
    severity: options.severity ?? 'medium',
    detect,
  };
}
