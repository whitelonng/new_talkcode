// src/types/ralph-loop.ts

export type RalphLoopStopReason =
  | 'complete'
  | 'blocked'
  | 'max-iterations'
  | 'max-wall-time'
  | 'error'
  | 'unknown';

export interface RalphLoopStopCriteria {
  requirePassingTests: boolean;
  requireLint: boolean;
  requireTsc: boolean;
  requireNoErrors: boolean;
  successRegex?: string;
  blockedRegex?: string;
}

export interface RalphLoopMemoryStrategy {
  summaryFileName: string;
  feedbackFileName: string;
  stateFileName: string;
}

export interface RalphLoopContextFreshness {
  includeLastNMessages?: number;
}

export interface RalphLoopConfig {
  enabled: boolean;
  maxIterations: number;
  maxWallTimeMs: number;
  stopCriteria: RalphLoopStopCriteria;
  memory: RalphLoopMemoryStrategy;
  context: RalphLoopContextFreshness;
}

export interface RalphLoopIterationResult {
  iteration: number;
  stopReason: RalphLoopStopReason | null;
  stopMessage?: string;
  completionPromiseMatched: boolean;
  errors: string[];
  startedAt: number;
  finishedAt: number;
}

export interface RalphLoopStateFile {
  taskId: string;
  startedAt: number;
  updatedAt: number;
  iteration: number;
  stopReason: RalphLoopStopReason | null;
  stopMessage?: string;
  completionPromiseMatched: boolean;
  errors: string[];
}
