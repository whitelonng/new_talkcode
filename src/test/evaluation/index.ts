/**
 * Agent Behavior Evaluation System
 * Provides deterministic Agent evaluation metrics and tools
 */

// Golden Dataset evaluation
export {
  type EvaluationOptions,
  type EvaluationReport,
  type EvaluationResult,
  type EvaluationScores,
  type GoldenCase,
  generateReportSummary,
  runGoldenEvaluation,
} from './golden-evaluator';

export {
  type ArgumentCorrectnessOptions,
  type ArgumentCorrectnessResult,
  argMatchers,
  evaluateArgumentCorrectness,
  evaluateMultipleArgumentCorrectness,
} from './metrics/argument-correctness';

export {
  analyzeStepSequence,
  createRedundantPattern,
  defaultRedundantPatterns,
  evaluateStepEfficiency,
  type RedundantPattern,
  type StepEfficiencyOptions,
  type StepEfficiencyResult,
  type TraceStep,
} from './metrics/step-efficiency';
// Evaluation metrics
export {
  evaluateToolCorrectness,
  evaluateToolCorrectnessBatch,
  type ToolCall,
  type ToolCorrectnessOptions,
  type ToolCorrectnessResult,
} from './metrics/tool-correctness';
// Trace recording
export {
  type AgentTrace,
  AgentTraceRecorder,
  createTraceRecorder,
  deserializeTrace,
  extractToolCalls,
  extractToolResults,
  serializeTrace,
  type ToolCallData,
  type ToolResultData,
  traceRecorder,
} from './trace-recorder';
