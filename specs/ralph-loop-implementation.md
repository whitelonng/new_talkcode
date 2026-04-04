# Ralph Loop Implementation Specification

## Overview

Ralph Loop is a persistent execution mode in TalkCody that repeatedly re-runs the same task with fresh context, while persisting high-signal memory and enforcing deterministic stop criteria. This feature enables AI agents to autonomously iterate through complex tasks, learning from previous attempts until completion criteria are met.

**Commit:** `24261a4ac44e99c2abe17322bf86850858f70c2a`

## Design Concept

### Problem Statement

AI agents often require multiple iterations to complete complex tasks due to:
- Context window limitations
- Learning through trial and error
- Need for progressive refinement
- Requirement to verify work (tests, linting, type checking)

Traditional single-pass execution leaves the agent unable to self-correct or iterate based on execution feedback.

### Solution: Ralph Loop

Ralph Loop implements a controlled iteration loop where:

1. **Fresh Context per Iteration**: Each iteration starts with a clean context, avoiding token bloat
2. **Memory Persistence**: High-signal information (summaries, feedback, state) persists between iterations
3. **Deterministic Stop Criteria**: Clear, automated conditions for when to stop iterating
4. **Completion Promise**: The AI must explicitly declare when the task is complete

### Key Principles

- **Deterministic**: Loop must terminate; no infinite loops allowed
- **Self-Correcting**: Agent learns from previous iterations via persisted feedback
- **Transparent**: Each iteration's state is visible and inspectable
- **Configurable**: Stop criteria and behavior are tunable per task

## Architecture (Redesigned - Stop-Hook Style)

### System Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ExecutionService                              │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Call llmService.runAgentLoop (no Ralph branching)              ││
│  └──────────────────┬──────────────────────────────────────────────┘│
└─────────────────────┼───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        LLMService.runAgentLoop                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Agent Loop (inner)                                             ││
│  │  ┌───────────────────────────────────────────────────────────┐  ││
│  │  │  While !isComplete && iteration < maxIterations:          │  ││
│  │  │    - Stream LLM response                                  │  ││
│  │  │    - Execute tools                                        │  ││
│  │  │    - Check stop criteria                                  │  ││
│  │  └───────────────────────────────────────────────────────────┘  ││
│  └──────────────────┬──────────────────────────────────────────────┘│
│                     │ Successful Finish (no tool calls)             │
│                     ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Completion Hook Pipeline                                       ││
│  │  ┌───────────────────────────────────────────────────────────┐  ││
│  │  │  1. Stop Hook (existing)                                  │  ││
│  │  │     - Can block/continue with user message                │  ││
│  │  └───────────────────────────────────────────────────────────┘  ││
│  │  ┌───────────────────────────────────────────────────────────┐  ││
│  │  │  2. Ralph Loop Hook (new)                                 │  ││
│  │  │     - Evaluate stop criteria                              │  ││
│  │  │     - Persist artifacts                                   │  ││
│  │  │     - Decide: stop or continue with fresh context         │  ││
│  │  └───────────────────────────────────────────────────────────┘  ││
│  │  ┌───────────────────────────────────────────────────────────┐  ││
│  │  │  3. Auto Code Review (existing)                           │  ││
│  │  │     - Only if both above allow stop                       │  ││
│  │  └───────────────────────────────────────────────────────────┘  ││
│  └──────────────────┬──────────────────────────────────────────────┘│
│                     │ If Ralph requests continue:                   │
│                     │   - Reset loopState.messages                  │
│                     │   - Reset streamProcessor                     │
│                     │   - Continue outer loop                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Redesign?

**Previous Architecture Issues:**
1. `RalphLoopService.runLoop` called `llmService.runAgentLoop` internally, creating nested loops
2. Duplicate message streaming logic in both services
3. Ralph bypassed the stop hook and auto code review sequencing in LLMService
4. Complex branching in ExecutionService

**New Architecture Benefits:**
1. **Single source of truth**: LLMService owns the loop orchestration
2. **Proper sequencing**: Stop hook → Ralph → Auto review in deterministic order
3. **Cleaner separation**: Ralph is a completion evaluator, not a loop runner
4. **Extensibility**: Completion hook pipeline allows easy addition of new hooks

### File Structure

```
src/
├── types/
│   ├── ralph-loop.ts              # Type definitions
│   └── completion-hooks.ts        # NEW: Completion hook interfaces
├── services/
│   └── agents/
│       ├── ralph-loop-service.ts  # Core evaluator (refactored)
│       ├── ralph-loop-service.test.ts
│       ├── llm-service.ts         # Added completion hook pipeline
│       ├── llm-completion-hooks.ts # NEW: Hook pipeline manager
│       ├── tool-executor.ts       # Added onToolResult callback
│       └── stream-processor.ts    # Already has fullReset()
├── services/
│   └── execution-service.ts       # Simplified (no Ralph branching)
├── stores/
│   └── ralph-loop-store.ts        # State management
├── components/
│   └── chat/
│       └── chat-input.tsx         # UI controls
└── locales/
    ├── en.ts                      # English translations
    └── zh.ts                      # Chinese translations
```

## Core Implementation

### Type Definitions

#### RalphLoopConfig

```typescript
export interface RalphLoopConfig {
  enabled: boolean;
  maxIterations: number;           // Maximum iterations (default: 6)
  maxWallTimeMs: number;           // Maximum execution time (default: 60min)
  stopCriteria: RalphLoopStopCriteria;
  memory: RalphLoopMemoryStrategy;
  context: RalphLoopContextFreshness;
}
```

#### Stop Criteria

```typescript
export interface RalphLoopStopCriteria {
  requirePassingTests: boolean;    // Require tests to pass
  requireLint: boolean;            // Require lint to pass
  requireTsc: boolean;             // Require TypeScript check to pass
  requireNoErrors: boolean;        // Require no tool/execution errors
  successRegex?: string;           // Regex pattern for completion (default: '<ralph>COMPLETE</ralph>')
  blockedRegex?: string;           // Regex pattern for blocked state (default: '<ralph>BLOCKED:(.*?)</ralph>')
}
```

#### Stop Reasons

```typescript
export type RalphLoopStopReason =
  | 'complete'      // Task completed successfully
  | 'blocked'       // Task blocked (missing info, etc.)
  | 'max-iterations' // Reached max iteration limit
  | 'max-wall-time'  // Reached time limit
  | 'error'         // Execution error occurred
  | 'unknown';      // Unknown state
```

#### Completion Hook Types (NEW)

```typescript
// src/types/completion-hooks.ts

export interface CompletionHookContext {
  taskId: string;
  fullText: string;
  toolSummaries: ToolSummary[];
  loopState: AgentLoopState;
  iteration: number;
  startTime: number;
}

export interface CompletionHookResult {
  action: 'stop' | 'continue' | 'skip';
  stopReason?: RalphLoopStopReason;
  stopMessage?: string;
  nextMessages?: UIMessage[];  // For 'continue' action
}

export interface CompletionHook {
  name: string;
  priority: number;  // Lower = earlier
  shouldRun: (context: CompletionHookContext) => boolean;
  run: (context: CompletionHookContext) => Promise<CompletionHookResult>;
}

export interface ToolSummary {
  toolName: string;
  toolCallId: string;
  command?: string;      // For bash tool
  success?: boolean;
  output?: string;
  error?: string;
}
```

### Completion Hook Pipeline (NEW)

The completion hook pipeline runs after a successful agent loop finish (no tool calls):

```typescript
// src/services/agents/llm-completion-hooks.ts

export class CompletionHookPipeline {
  private hooks: CompletionHook[] = [];

  register(hook: CompletionHook): void {
    this.hooks.push(hook);
    // Sort by priority (lower = earlier)
    this.hooks.sort((a, b) => a.priority - b.priority);
  }

  async run(context: CompletionHookContext): Promise<CompletionHookResult> {
    for (const hook of this.hooks) {
      if (!hook.shouldRun(context)) {
        continue;
      }

      const result = await hook.run(context);

      if (result.action === 'continue') {
        // Early termination - request to continue with new context
        return result;
      }

      if (result.action === 'stop') {
        // Stop the entire execution
        return result;
      }

      // 'skip' - continue to next hook
    }

    // All hooks passed, allow stop
    return { action: 'stop' };
  }
}

// Singleton instance
export const completionHookPipeline = new CompletionHookPipeline();
```

### Ralph Loop as Completion Hook

```typescript
// src/services/agents/ralph-loop-service.ts (refactored)

export class RalphLoopService implements CompletionHook {
  name = 'ralph-loop';
  priority = 20;  // After stop hook (10), before auto review (30)

  shouldRun(context: CompletionHookContext): boolean {
    return isRalphLoopEnabled(context.taskId);
  }

  async run(context: CompletionHookContext): Promise<CompletionHookResult> {
    const { taskId, fullText, toolSummaries, loopState, iteration, startTime } = context;

    // Check max iterations
    if (iteration >= DEFAULT_CONFIG.maxIterations) {
      await this.persistFinalState({
        taskId,
        iteration,
        startTime,
        stopReason: 'max-iterations',
        stopMessage: 'Reached max iterations',
      });
      return { action: 'stop', stopReason: 'max-iterations' };
    }

    // Check wall time
    const elapsed = Date.now() - startTime;
    if (elapsed > DEFAULT_CONFIG.maxWallTimeMs) {
      await this.persistFinalState({
        taskId,
        iteration,
        startTime,
        stopReason: 'max-wall-time',
        stopMessage: 'Reached max wall time',
      });
      return { action: 'stop', stopReason: 'max-wall-time' };
    }

    // Evaluate stop criteria
    const evaluation = this.evaluateStopCriteria({
      fullText,
      toolSummaries,
      stopCriteria: DEFAULT_CONFIG.stopCriteria,
    });

    // Persist iteration artifacts
    await this.persistIterationArtifacts({
      taskId,
      iteration,
      startTime,
      fullText,
      toolSummaries,
      evaluation,
    });

    if (evaluation.shouldStop) {
      return {
        action: 'stop',
        stopReason: evaluation.stopReason,
        stopMessage: evaluation.stopMessage,
      };
    }

    // Continue with fresh context
    const nextMessages = await this.buildIterationMessages({
      taskId,
      userMessage: this.getBaseUserMessage(taskId),
      includeLastN: DEFAULT_CONFIG.context.includeLastNMessages,
    });

    return {
      action: 'continue',
      nextMessages,
    };
  }

  // ... other methods: evaluateStopCriteria, persistIterationArtifacts, etc.
}

export const ralphLoopService = new RalphLoopService();
```

### LLMService Integration

```typescript
// src/services/agents/llm-service.ts (relevant parts)

export class LLMService {
  private toolSummaries: ToolSummary[] = [];
  private ralphIteration = 0;
  private ralphStartTime = 0;

  async runAgentLoop(
    options: AgentLoopOptions,
    callbacks: AgentLoopCallbacks,
    abortController?: AbortController
  ): Promise<void> {
    // ... initialization ...

    this.ralphStartTime = Date.now();
    this.ralphIteration = 0;

    while (true) {
      this.ralphIteration++;

      // Reset tool summaries for this iteration
      this.toolSummaries = [];

      // ... main agent loop ...

      // After successful finish (no tool calls)
      if (toolCalls.length === 0) {
        const fullText = streamProcessor.getFullText();

        // Build completion context
        const completionContext: CompletionHookContext = {
          taskId: this.taskId,
          fullText,
          toolSummaries: this.toolSummaries,
          loopState,
          iteration: this.ralphIteration,
          startTime: this.ralphStartTime,
        };

        // Run completion hook pipeline
        const result = await completionHookPipeline.run(completionContext);

        if (result.action === 'continue' && result.nextMessages) {
          // Ralph wants to continue with fresh context

          // 1. Reset loopState.messages
          const newModelMessages = await convertMessages(result.nextMessages, {
            rootPath,
            systemPrompt: options.systemPrompt,
            model: options.model,
          });

          loopState.messages = convertToAnthropicFormat(newModelMessages, {
            autoFix: true,
            trimAssistantWhitespace: true,
          });

          // 2. Reset other loopState fields
          loopState.lastRequestTokens = 0;
          loopState.unknownFinishReasonCount = 0;
          loopState.lastFinishReason = undefined;

          // 3. Reset stream processor for fresh iteration
          streamProcessor.fullReset();

          // 4. Continue the outer loop
          continue;
        }

        if (result.action === 'stop') {
          // Finalize and exit
          onComplete?.(fullText);
          break;
        }
      }

      // ... handle tool calls ...
    }
  }

  // Capture tool results for Ralph evaluation
  private onToolResult(toolName: string, result: unknown, toolCallId: string): void {
    const summary: ToolSummary = {
      toolName,
      toolCallId,
    };

    if (toolName === 'bash' && isBashResult(result)) {
      summary.command = result.command;
      summary.success = result.success;
      summary.output = result.output;
      summary.error = result.error;
    } else if (result && typeof result === 'object' && 'error' in result) {
      summary.error = String((result as { error?: string }).error);
    }

    this.toolSummaries.push(summary);
  }
}
```

### Tool Result Capture

To enable Ralph to evaluate tool results, we capture structured tool outputs:

```typescript
// src/services/agents/tool-executor.ts (modification)

export class ToolExecutor {
  async executeToolCall(
    toolCall: ToolCallInfo,
    options: ToolExecutionOptions,
    onToolResult?: (toolName: string, result: unknown, toolCallId: string) => void
  ): Promise<unknown> {
    // ... execute tool ...

    const result = await this.executeTool(tool, parsedArgs, context);

    // Notify callback with structured result
    onToolResult?.(toolCall.toolName, result, toolCall.toolCallId);

    return result;
  }
}
```

### ExecutionService Simplification

```typescript
// src/services/execution-service.ts (simplified)

class ExecutionService {
  async startExecution(config: ExecutionConfig, callbacks?: ExecutionCallbacks): Promise<void> {
    // ... setup ...

    try {
      // Create LLMService instance
      llmService = createLLMService(taskId);
      this.llmServiceInstances.set(taskId, llmService);

      // Register completion hooks (done once at app startup)
      // completionHookPipeline.register(stopHookService);  // priority 10
      // completionHookPipeline.register(ralphLoopService); // priority 20
      // completionHookPipeline.register(autoCodeReviewService); // priority 30

      // Always call runAgentLoop - Ralph behavior is handled via completion hooks
      await llmService.runAgentLoop(
        {
          messages,
          model,
          systemPrompt,
          tools,
          agentId,
        },
        {
          // ... callbacks ...
        },
        abortController
      );

    } catch (error) {
      // ... error handling ...
    }
  }
}
```

### LoopState Reset (per your request)

When Ralph decides to continue:

1. **Clear `loopState.messages`**: Replace with fresh iteration messages built from task + summary + feedback
2. **Reset `loopState.lastRequestTokens`**: Fresh context has new token count
3. **Reset `loopState.unknownFinishReasonCount`**: Fresh iteration should not carry retry state
4. **Reset `loopState.lastFinishReason`**: Fresh start
5. **Reset `streamProcessor`**: Call `fullReset()` to clear accumulated text and state

The `loopState.currentIteration` continues incrementing (it's the agent's internal step counter, not Ralph's iteration counter).

## Memory Persistence

### When Artifacts Are Written

**Only on successful finish (no tool calls):**
- Ralph hook evaluates stop criteria
- If continuing: `persistIterationArtifacts()` writes iteration state
- If stopping: `persistFinalState()` writes final state

**NOT written on errors:**
- If the agent loop throws, artifacts are not updated
- This prevents corrupted state from error conditions

### Summary File (`ralph-summary.md`)

Each iteration updates a cumulative summary:

```markdown
# Ralph Loop Summary

## Objective
[Original user task]

## Iteration N
Stop candidate: [stop reason]
Completion marker: [matched / not found]
Stop message: [if applicable]

## Files Changed
- file1.ts
- file2.ts

## Tool Results
- bash (bun run test): passed
- bash (bun run lint): failed

## Errors
- Error message 1
- Error message 2

## Last Output (truncated)
[Agent output, truncated to 1200 chars]

## Previous Summary
[Previous iteration's summary]
```

### State File (`ralph-iteration.json`)

Persists iteration state for inspection:

```json
{
  "taskId": "task-1",
  "startedAt": 1737864000000,
  "updatedAt": 1737864300000,
  "iteration": 3,
  "stopReason": "complete",
  "stopMessage": "Task completed",
  "completionPromiseMatched": true,
  "errors": []
}
```

## User Interface

### Chat Input Control

A toggle switch in the chat input area:

```tsx
<Switch
  checked={isRalphLoopEnabled}
  onCheckedChange={toggleRalphLoop}
  disabled={isLoading}
/>
```

### Hover Card

Provides context and documentation link:

```tsx
<HoverCardContent>
  <h4>Ralph Loop</h4>
  <p>{description}</p>
  <a href={docLinks.features.ralphLoop}>Learn more</a>
</HoverCardContent>
```

### Translations

English:

```typescript
ralphLoop: {
  label: 'Ralph Loop',
  title: 'Ralph Loop',
  description: 'Continuously iterate until completion criteria are met.',
  enabledTooltip: 'Ralph Loop: iterate until completion criteria are met.',
  disabledTooltip: 'Run a single pass without Ralph Loop iterations.',
  learnMore: 'Learn more',
}
```

Chinese:

```typescript
ralphLoop: {
  label: 'Ralph Loop',
  title: 'Ralph Loop',
  description: '持续迭代直到满足完成标准。',
  enabledTooltip: 'Ralph Loop：持续迭代直到满足完成标准。',
  disabledTooltip: '单次执行，不启用 Ralph Loop 迭代。',
  learnMore: '了解更多',
}
```

## Testing

### Test Coverage

The implementation includes comprehensive tests:

```typescript
describe('RalphLoopService', () => {
  it('evaluates stop criteria correctly');
  it('persists iteration artifacts on successful finish');
  it('returns continue action when criteria not met');
  it('returns stop action when max iterations reached');
  it('returns stop action when completion marker found');
  it('returns stop action when blocked marker found');
});

describe('LLMService Completion Hooks', () => {
  it('runs completion hook pipeline on successful finish');
  it('continues loop when Ralph requests continuation');
  it('resets loopState.messages on continuation');
  it('resets streamProcessor on continuation');
  it('captures structured tool results');
});

describe('ExecutionService', () => {
  it('calls llmService.runAgentLoop without Ralph branching');
  it('handles Ralph continuation correctly');
});
```

### Test Strategy

- Mock dependencies (messageService, taskFileService, stores)
- Simulate agent loop execution
- Verify completion hook sequencing
- Validate artifact persistence
- Test loopState reset behavior
- Test boundary conditions (max iterations, wall time)

## Configuration Examples

### Default Configuration

```typescript
const DEFAULT_CONFIG: RalphLoopConfig = {
  enabled: true,
  maxIterations: 6,
  maxWallTimeMs: 60 * 60 * 1000,  // 1 hour
  stopCriteria: {
    requirePassingTests: false,
    requireLint: false,
    requireTsc: false,
    requireNoErrors: true,
    successRegex: '<ralph>COMPLETE</ralph>',
    blockedRegex: '<ralph>BLOCKED:(.*?)</ralph>',
  },
  memory: {
    summaryFileName: 'ralph-summary.md',
    feedbackFileName: 'ralph-feedback.md',
    stateFileName: 'ralph-iteration.json',
  },
  context: {
    includeLastNMessages: 0,
  },
};
```

### Strict Mode Configuration

```typescript
const STRICT_CONFIG: RalphLoopConfig = {
  ...DEFAULT_CONFIG,
  stopCriteria: {
    requirePassingTests: true,
    requireLint: true,
    requireTsc: true,
    requireNoErrors: true,
  },
};
```

### Per-Task Override

```typescript
const taskSettings: TaskSettings = {
  ralphLoopEnabled: true,
  // ... other settings
};
```

## Flow Diagram

### New Architecture Flow

```
User Request
    │
    ▼
┌─────────────────┐
│ ExecutionService │
│  (no branching)  │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────┐
│      LLMService.runAgentLoop     │
│                                  │
│  ┌────────────────────────────┐  │
│  │    Agent Loop (inner)      │  │
│  │  - Stream LLM              │  │
│  │  - Execute tools           │  │
│  │  - Build tool summaries    │  │
│  └────────┬───────────────────┘  │
│           │ No tool calls        │
│           ▼                      │
│  ┌────────────────────────────┐  │
│  │   Completion Hook Pipeline │  │
│  │                            │  │
│  │  1. Stop Hook              │  │
│  │     ├─ Block → Stop        │  │
│  │     └─ Continue → Next     │  │
│  │                            │  │
│  │  2. Ralph Loop Hook        │  │
│  │     ├─ Stop criteria met   │  │
│  │     │  ├─ Persist artifacts│  │
│  │     │  └─ Stop             │  │
│  │     └─ Continue needed     │  │
│  │        ├─ Persist artifacts│  │
│  │        ├─ Reset loopState  │  │
│  │        └─ Continue loop ──┐│  │
│  │                            ││  │
│  │  3. Auto Code Review       ││  │
│  │     └─ Only if stopping    ││  │
│  └────────────────────────────┘│  │
│           │                    │  │
│           ▼ Continue           │  │
│  ┌────────────────────────────┐│  │
│  │  Reset loopState.messages  ││  │
│  │  Reset streamProcessor     ││  │
│  └────────────────────────────┘│  │
│           │                    │  │
│           └────────────────────┘  │
│                    │               │
│                    ▼               │
│           ┌──────────────┐         │
│           │ Next Iteration│◄────────┘
│           └──────────────┘
│
└──────────────────────────────────┘
```

## Key Design Decisions

### 1. Completion Hook Pipeline

**Decision:** Use a pluggable completion hook pipeline (Option B) instead of inline logic (Option A).

**Rationale:**
- Clear separation of concerns
- Deterministic execution order
- Easy to add new hooks
- Follows open/closed principle
- Makes LLMService more extensible

### 2. Ralph as Completion Hook, Not Loop Runner

**Decision:** RalphLoopService implements `CompletionHook` interface instead of running its own loop.

**Rationale:**
- Single source of truth for loop orchestration
- Proper integration with stop hook and auto review
- Eliminates nested loop complexity
- Simplifies message streaming

### 3. Fresh Context on Continuation

**Decision:** Reset `loopState.messages` with fresh iteration context when Ralph requests continuation.

**Rationale:**
- Prevents token bloat
- Provides clean slate for next iteration
- Maintains learning via persisted summary/feedback files
- Resets stream processor to avoid text accumulation issues

### 4. Structured Tool Result Capture

**Decision:** Capture structured tool results via `onToolResult` callback instead of parsing stringified output.

**Rationale:**
- More reliable than regex parsing
- Preserves type information
- Enables accurate stop criteria evaluation
- Cleaner separation of concerns

### 5. Persist Only on Successful Finish

**Decision:** Write `ralph-summary.md` and `ralph-iteration.json` only on successful completion (no tool calls), not on errors.

**Rationale:**
- Prevents corrupted state from error conditions
- Aligns with completion hook semantics
- Simplifies error recovery
- Clearer artifact semantics

## Migration Guide

### From Old Architecture

**Before:**
```typescript
// ExecutionService
if (ralphLoopEnabled) {
  await ralphLoopService.runLoop({...});  // Calls llmService.runAgentLoop internally
} else {
  await llmService.runAgentLoop({...});
}
```

**After:**
```typescript
// ExecutionService
await llmService.runAgentLoop({...});  // Ralph is a completion hook

// App initialization (once)
completionHookPipeline.register(stopHookService);
completionHookPipeline.register(ralphLoopService);
completionHookPipeline.register(autoCodeReviewService);
```

## Performance Considerations

### Cost Management

- **Max Iterations:** Limits token usage (default: 6)
- **Max Wall Time:** Prevents runaway execution (default: 1 hour)
- **Fresh Context:** Reduces cost per iteration by avoiding accumulated messages
- **No Duplicate Streaming:** Single message stream through LLMService

### Storage

- **Summary File:** Grows with iterations but is truncated
- **State File:** Fixed size, updated each iteration
- **Messages:** Only new messages per iteration, no duplication

### Memory

- **In-Memory State:** Minimal (iteration count, stop reason)
- **File I/O:** Async, non-blocking
- **Zustand Store:** Small, reactive updates

## Future Enhancements

### Potential Improvements

1. **Adaptive Max Iterations:** Dynamically adjust based on task complexity
2. **Parallel Verification:** Run tests/lint in parallel during iteration
3. **Progress Metrics:** Display progress to user (e.g., "3/6 iterations")
4. **Resume Capability:** Continue from interrupted loop
5. **Custom Regex Patterns:** Allow user-defined stop patterns
6. **Iteration Timeouts:** Per-iteration timeout in addition to wall time
7. **Memory Compression:** More sophisticated summarization strategies
8. **Context Presets:** Pre-defined context templates for common tasks

### Integration Opportunities

1. **Plan Mode:** Use Ralph Loop to execute multi-step plans
2. **Worktree:** Run Ralph Loop in worktree for isolated testing
3. **Deep Research:** Loop until research is complete
4. **Code Review:** Iterate until all review issues resolved

## References

- **Commit:** `24261a4ac44e99c2abe17322bf86850858f70c2a`
- **Main Implementation:** `src/services/agents/ralph-loop-service.ts`
- **Type Definitions:** `src/types/ralph-loop.ts`
- **Completion Hooks:** `src/types/completion-hooks.ts` (NEW)
- **Hook Pipeline:** `src/services/agents/llm-completion-hooks.ts` (NEW)
- **State Management:** `src/stores/ralph-loop-store.ts`
- **Integration:** `src/services/execution-service.ts`
- **UI:** `src/components/chat/chat-input.tsx`
- **Tests:** `src/services/agents/ralph-loop-service.test.ts`

## Summary

Ralph Loop provides a robust, configurable framework for iterative AI task execution. The redesigned architecture (stop-hook style) improves upon the original by:

1. **Centralizing loop orchestration** in LLMService
2. **Using a completion hook pipeline** for extensible post-execution logic
3. **Eliminating nested loops** and duplicate streaming logic
4. **Properly sequencing** stop hook → Ralph → auto review
5. **Capturing structured tool results** for accurate evaluation

This redesign makes the codebase clearer, more maintainable, and more extensible while preserving all existing functionality.
