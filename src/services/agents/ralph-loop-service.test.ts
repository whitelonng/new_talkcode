// src/services/agents/ralph-loop-service.test.ts
import { describe, expect, it, vi } from 'vitest';
import { ralphLoopService, isRalphLoopEnabled, DEFAULT_CONFIG } from '@/services/agents/ralph-loop-service';
import { taskFileService } from '@/services/task-file-service';
import type { CompletionHookContext, ToolSummary } from '@/types/completion-hooks';

vi.mock('@/services/task-file-service', () => ({
  taskFileService: {
    readFile: vi.fn(async () => null),
    writeFile: vi.fn(async () => '/tmp/mock'),
  },
}));

vi.mock('@/stores/file-changes-store', () => ({
  useFileChangesStore: {
    getState: () => ({
      getChanges: vi.fn(() => []),
    }),
  },
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: {
    getState: () => ({
      getRalphLoopEnabled: vi.fn(() => true),
    }),
  },
}));

vi.mock('@/stores/task-store', () => ({
  useTaskStore: {
    getState: () => ({
      getTask: vi.fn(() => ({
        id: 'task-1',
        settings: JSON.stringify({ ralphLoopEnabled: true }),
        title: 'Test task',
      })),
      getMessages: vi.fn(() => [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Build feature X',
          timestamp: new Date(),
        },
      ]),
    }),
  },
}));

describe('RalphLoopService - Completion Hook', () => {
  describe('shouldRun', () => {
    it('returns true when Ralph Loop is enabled', () => {
      const context = {
        taskId: 'task-1',
        fullText: '',
        toolSummaries: [],
        loopState: {
          messages: [],
          currentIteration: 1,
          isComplete: false,
          lastRequestTokens: 0,
        },
        iteration: 1,
        startTime: Date.now(),
      } as CompletionHookContext;

      expect(ralphLoopService.shouldRun(context)).toBe(true);
    });

    it('has correct hook priority', () => {
      // Ralph Loop should run after stop hook (10) and before auto review (30)
      expect(ralphLoopService.priority).toBe(20);
    });
  });

  describe('evaluateStopCriteria', () => {
    it('detects complete marker and returns shouldStop=true', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: 'Task completed successfully\n<ralph>COMPLETE</ralph>',
        toolSummaries: [],
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: DEFAULT_CONFIG.stopCriteria,
      });

      expect(result.shouldStop).toBe(true);
      expect(result.stopReason).toBe('complete');
      expect(result.completionPromiseMatched).toBe(true);
    });

    it('detects blocked marker and returns shouldStop=true with blocked reason', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: 'Cannot proceed\n<ralph>BLOCKED: missing API key</ralph>',
        toolSummaries: [],
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: DEFAULT_CONFIG.stopCriteria,
      });

      expect(result.shouldStop).toBe(true);
      expect(result.stopReason).toBe('blocked');
      expect(result.stopMessage).toBe('missing API key');
    });

    it('requires passing tests when stopCriteria.requirePassingTests is true', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: '<ralph>COMPLETE</ralph>',
        toolSummaries: [
          { toolName: 'bash', toolCallId: '1', command: 'bun run test', success: false },
        ],
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: { ...DEFAULT_CONFIG.stopCriteria, requirePassingTests: true },
      });

      expect(result.shouldStop).toBe(false);
      expect(result.stopReason).toBe('unknown');
    });

    it('requires lint to pass when stopCriteria.requireLint is true', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: '<ralph>COMPLETE</ralph>',
        toolSummaries: [
          { toolName: 'bash', toolCallId: '1', command: 'bun run lint', success: false },
        ],
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: { ...DEFAULT_CONFIG.stopCriteria, requireLint: true },
      });

      expect(result.shouldStop).toBe(false);
      expect(result.stopReason).toBe('unknown');
    });

    it('requires no errors when stopCriteria.requireNoErrors is true', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: '<ralph>COMPLETE</ralph>',
        toolSummaries: [
          { toolName: 'bash', toolCallId: '1', error: 'Command failed' },
        ],
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: { ...DEFAULT_CONFIG.stopCriteria, requireNoErrors: true },
      });

      expect(result.shouldStop).toBe(false);
      expect(result.stopReason).toBe('unknown');
    });

    it('returns shouldStop=false when no completion marker found', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: 'Still working on it...',
        toolSummaries: [],
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: DEFAULT_CONFIG.stopCriteria,
      });

      expect(result.shouldStop).toBe(false);
      expect(result.stopReason).toBe('unknown');
    });

    it('blocks completion when requirePassingTests is true but no tests were run', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: '<ralph>COMPLETE</ralph>',
        toolSummaries: [], // No test commands executed
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: { ...DEFAULT_CONFIG.stopCriteria, requirePassingTests: true },
      });

      // Should NOT stop because tests were required but not run
      expect(result.shouldStop).toBe(false);
      expect(result.stopReason).toBe('unknown');
    });

    it('blocks completion when requireLint is true but no lint was run', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: '<ralph>COMPLETE</ralph>',
        toolSummaries: [], // No lint commands executed
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: { ...DEFAULT_CONFIG.stopCriteria, requireLint: true },
      });

      // Should NOT stop because lint was required but not run
      expect(result.shouldStop).toBe(false);
      expect(result.stopReason).toBe('unknown');
    });

    it('blocks completion when requireTsc is true but no tsc was run', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: '<ralph>COMPLETE</ralph>',
        toolSummaries: [], // No tsc commands executed
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: { ...DEFAULT_CONFIG.stopCriteria, requireTsc: true },
      });

      // Should NOT stop because tsc was required but not run
      expect(result.shouldStop).toBe(false);
      expect(result.stopReason).toBe('unknown');
    });

    it('allows completion when requirePassingTests is true and tests passed', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: '<ralph>COMPLETE</ralph>',
        toolSummaries: [
          { toolName: 'bash', toolCallId: '1', command: 'bun run test', success: true },
        ],
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: { ...DEFAULT_CONFIG.stopCriteria, requirePassingTests: true },
      });

      expect(result.shouldStop).toBe(true);
      expect(result.stopReason).toBe('complete');
    });

    it('allows completion when requireLint is true and lint passed', () => {
      const result = ralphLoopService.evaluateStopCriteria({
        fullText: '<ralph>COMPLETE</ralph>',
        toolSummaries: [
          { toolName: 'bash', toolCallId: '1', command: 'bun run lint', success: true },
        ],
        successRegex: /\<ralph\>COMPLETE\<\/ralph\>/i,
        blockedRegex: /\<ralph\>BLOCKED:(.*?)\<\/ralph\>/i,
        stopCriteria: { ...DEFAULT_CONFIG.stopCriteria, requireLint: true },
      });

      expect(result.shouldStop).toBe(true);
      expect(result.stopReason).toBe('complete');
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes completion promise in system prompt', () => {
      const prompt = ralphLoopService.buildSystemPrompt('Base prompt', DEFAULT_CONFIG);

      expect(prompt).toContain('Ralph Loop completion promise');
      expect(prompt).toContain('<ralph>COMPLETE</ralph>');
      expect(prompt).toContain('<ralph>BLOCKED:');
    });

    it('includes stop criteria when configured', () => {
      const config = {
        ...DEFAULT_CONFIG,
        stopCriteria: {
          ...DEFAULT_CONFIG.stopCriteria,
          requirePassingTests: true,
          requireLint: true,
        },
      };

      const prompt = ralphLoopService.buildSystemPrompt('Base prompt', config);

      expect(prompt).toContain('Stop criteria:');
      expect(prompt).toContain('Run tests');
      expect(prompt).toContain('Run lint');
    });

    it('preserves base system prompt', () => {
      const prompt = ralphLoopService.buildSystemPrompt('Custom base prompt', DEFAULT_CONFIG);

      expect(prompt).toContain('Custom base prompt');
    });
  });

  describe('run (completion hook)', () => {
    it('returns stop action when completion criteria met', async () => {
      const context: CompletionHookContext = {
        taskId: 'task-1',
        fullText: 'Task done\n<ralph>COMPLETE</ralph>',
        toolSummaries: [],
        loopState: {
          messages: [],
          currentIteration: 1,
          isComplete: false,
          lastRequestTokens: 0,
        },
        iteration: 1,
        startTime: Date.now(),
      };

      const result = await ralphLoopService.run(context);

      expect(result.action).toBe('stop');
      expect(result.stopReason).toBe('complete');
    });

    it('returns continue action when criteria not met', async () => {
      const context: CompletionHookContext = {
        taskId: 'task-1',
        fullText: 'Still working on it...',
        toolSummaries: [],
        loopState: {
          messages: [],
          currentIteration: 1,
          isComplete: false,
          lastRequestTokens: 0,
        },
        iteration: 1,
        startTime: Date.now(),
      };

      const result = await ralphLoopService.run(context);

      expect(result.action).toBe('continue');
      expect(result.nextMessages).toBeDefined();
      expect(result.nextMessages?.length).toBeGreaterThan(0);
    });

    it('returns stop action when max iterations reached', async () => {
      const context: CompletionHookContext = {
        taskId: 'task-1',
        fullText: 'Still working...',
        toolSummaries: [],
        loopState: {
          messages: [],
          currentIteration: 100,
          isComplete: false,
          lastRequestTokens: 0,
        },
        iteration: DEFAULT_CONFIG.maxIterations + 1,
        startTime: Date.now(),
      };

      const result = await ralphLoopService.run(context);

      expect(result.action).toBe('stop');
      expect(result.stopReason).toBe('max-iterations');
    });

    it('returns stop action when max wall time reached', async () => {
      const context: CompletionHookContext = {
        taskId: 'task-1',
        fullText: 'Still working...',
        toolSummaries: [],
        loopState: {
          messages: [],
          currentIteration: 1,
          isComplete: false,
          lastRequestTokens: 0,
        },
        iteration: 1,
        startTime: Date.now() - DEFAULT_CONFIG.maxWallTimeMs - 1000, // Past the limit
      };

      const result = await ralphLoopService.run(context);

      expect(result.action).toBe('stop');
      expect(result.stopReason).toBe('max-wall-time');
    });

    it('persists artifacts when running', async () => {
      const writeFileSpy = vi.mocked(taskFileService.writeFile);
      writeFileSpy.mockClear();

      const context: CompletionHookContext = {
        taskId: 'task-1',
        fullText: 'Task done\n<ralph>COMPLETE</ralph>',
        toolSummaries: [],
        loopState: {
          messages: [],
          currentIteration: 1,
          isComplete: false,
          lastRequestTokens: 0,
        },
        iteration: 1,
        startTime: Date.now(),
      };

      await ralphLoopService.run(context);

      expect(writeFileSpy).toHaveBeenCalled();
    });
  });

  describe('buildIterationMessages', () => {
    it('includes task description in messages', async () => {
      const messages = await ralphLoopService.buildIterationMessages({
        taskId: 'task-1',
      });

      expect(messages.length).toBeGreaterThan(0);
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toContain('Test task'); // Task title from mock
    });

    it('includes Ralph Summary when available', async () => {
      vi.mocked(taskFileService.readFile).mockImplementation(async (_type, _taskId, filename) => {
        if (filename === 'ralph-summary.md') {
          return '# Previous Summary\n\nSome context';
        }
        return null;
      });

      const messages = await ralphLoopService.buildIterationMessages({
        taskId: 'task-1',
      });

      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.content).toContain('Ralph Summary');
      expect(lastMessage.content).toContain('Previous Summary');
    });

    it('includes Ralph Feedback when available', async () => {
      vi.mocked(taskFileService.readFile).mockImplementation(async (_type, _taskId, filename) => {
        if (filename === 'ralph-feedback.md') {
          return 'Fix the error in line 10';
        }
        return null;
      });

      const messages = await ralphLoopService.buildIterationMessages({
        taskId: 'task-1',
      });

      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.content).toContain('Ralph Feedback');
      expect(lastMessage.content).toContain('Fix the error');
    });
  });
});

describe('isRalphLoopEnabled', () => {
  it('returns true when enabled in task settings', () => {
    expect(isRalphLoopEnabled('task-1')).toBe(true);
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.maxIterations).toBe(6);
    expect(DEFAULT_CONFIG.maxWallTimeMs).toBe(60 * 60 * 1000); // 1 hour
    expect(DEFAULT_CONFIG.stopCriteria.requireNoErrors).toBe(true);
    expect(DEFAULT_CONFIG.memory.summaryFileName).toBe('ralph-summary.md');
  });
});
