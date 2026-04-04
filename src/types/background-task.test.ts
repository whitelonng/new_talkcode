// src/types/background-task.test.ts
// Tests for background task type definitions

import { describe, it, expect } from 'vitest';
import {
  MAX_CONCURRENT_TASKS,
  POLLING_INTERVAL_MS,
  MIN_POLLING_INTERVAL_MS,
  MAX_POLLING_INTERVAL_MS,
  toBackgroundTaskInfo,
} from './background-task';
import type {
  BackgroundTaskStatus,
  BackgroundTask,
  BackgroundTaskInfo,
} from './background-task';

describe('Background Task Types', () => {
  // =========================================================================
  // Tests for constants
  // =========================================================================

  describe('Constants', () => {
    it('MAX_CONCURRENT_TASKS should be reasonable', () => {
      expect(MAX_CONCURRENT_TASKS).toBeGreaterThan(0);
      expect(MAX_CONCURRENT_TASKS).toBeLessThanOrEqual(100);
      expect(MAX_CONCURRENT_TASKS).toBe(10);
    });

    it('POLLING_INTERVAL_MS should be within valid range', () => {
      expect(POLLING_INTERVAL_MS).toBeGreaterThanOrEqual(MIN_POLLING_INTERVAL_MS);
      expect(POLLING_INTERVAL_MS).toBeLessThanOrEqual(MAX_POLLING_INTERVAL_MS);
    });

    it('MIN and MAX polling intervals should be sensible', () => {
      expect(MIN_POLLING_INTERVAL_MS).toBeGreaterThan(0);
      expect(MIN_POLLING_INTERVAL_MS).toBe(1000); // At least 1 second
      expect(MAX_POLLING_INTERVAL_MS).toBe(30000); // At most 30 seconds
      expect(MIN_POLLING_INTERVAL_MS).toBeLessThan(MAX_POLLING_INTERVAL_MS);
    });
  });

  // =========================================================================
  // Tests for toBackgroundTaskInfo converter
  // =========================================================================

  describe('toBackgroundTaskInfo', () => {
    const createRustDto = () => ({
      taskId: 'bg_test123',
      pid: 12345,
      command: 'npm run build',
      status: 'running' as BackgroundTaskStatus,
      exitCode: undefined,
      startTime: 1700000000000,
      endTime: undefined,
      outputFile: '/data/background/bg_test123/stdout.log',
      errorFile: '/data/background/bg_test123/stderr.log',
      maxTimeoutMs: 7200000,
      isTimedOut: false,
    });

    it('should convert Rust DTO to frontend format', () => {
      const dto = createRustDto();
      const result = toBackgroundTaskInfo(dto, 'conv-123', 'tool-456');

      expect(result.taskId).toBe('bg_test123');
      expect(result.pid).toBe(12345);
      expect(result.command).toBe('npm run build');
      expect(result.status).toBe('running');
      expect(result.conversationTaskId).toBe('conv-123');
      expect(result.toolId).toBe('tool-456');
    });

    it('should use empty strings for optional parameters', () => {
      const dto = createRustDto();
      const result = toBackgroundTaskInfo(dto);

      expect(result.conversationTaskId).toBe('');
      expect(result.toolId).toBe('');
    });

    it('should preserve all fields from DTO', () => {
      const dto = createRustDto();
      dto.exitCode = 0;
      dto.endTime = 1700000001000;
      dto.isTimedOut = false;

      const result = toBackgroundTaskInfo(dto, 'conv', 'tool');

      expect(result.exitCode).toBe(0);
      expect(result.endTime).toBe(1700000001000);
      expect(result.isTimedOut).toBe(false);
      expect(result.maxTimeoutMs).toBe(7200000);
    });

    it('should handle timed out task', () => {
      const dto = createRustDto();
      dto.status = 'timeout';
      dto.isTimedOut = true;

      const result = toBackgroundTaskInfo(dto);

      expect(result.status).toBe('timeout');
      expect(result.isTimedOut).toBe(true);
    });
  });

  // =========================================================================
  // Tests for BackgroundTaskStatus type (compile-time checks)
  // =========================================================================

  describe('BackgroundTaskStatus', () => {
    it('should accept valid status values', () => {
      const statuses: BackgroundTaskStatus[] = [
        'running',
        'completed',
        'failed',
        'killed',
        'timeout',
      ];

      // All should be valid (this is a compile-time check that would fail if types are wrong)
      expect(statuses.length).toBe(5);
    });
  });

  // =========================================================================
  // Tests for BackgroundTask interface
  // =========================================================================

  describe('BackgroundTask interface', () => {
    it('should have all required fields', () => {
      const task: BackgroundTask = {
        taskId: 'test-1',
        pid: 100,
        command: 'echo hello',
        status: 'running',
        startTime: Date.now(),
        outputFile: '/tmp/out.log',
        errorFile: '/tmp/err.log',
        conversationTaskId: 'conv-1',
        toolId: 'tool-1',
      };

      expect(task.taskId).toBeDefined();
      expect(task.pid).toBeDefined();
      expect(task.command).toBeDefined();
      expect(task.status).toBeDefined();
      expect(task.startTime).toBeDefined();
      expect(task.outputFile).toBeDefined();
      expect(task.errorFile).toBeDefined();
      expect(task.conversationTaskId).toBeDefined();
      expect(task.toolId).toBeDefined();
    });

    it('should allow optional fields', () => {
      const task: BackgroundTask = {
        taskId: 'test-2',
        pid: 200,
        command: 'npm test',
        status: 'completed',
        exitCode: 0,
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        outputFile: '/tmp/out.log',
        errorFile: '/tmp/err.log',
        conversationTaskId: 'conv-2',
        toolId: 'tool-2',
        maxTimeoutMs: 3600000,
        lastOutput: {
          stdoutBytesRead: 1024,
          stderrBytesRead: 256,
        },
        isTimedOut: false,
      };

      expect(task.exitCode).toBe(0);
      expect(task.endTime).toBeDefined();
      expect(task.maxTimeoutMs).toBe(3600000);
      expect(task.lastOutput?.stdoutBytesRead).toBe(1024);
      expect(task.isTimedOut).toBe(false);
    });
  });

  // =========================================================================
  // Tests for BackgroundTaskInfo interface
  // =========================================================================

  describe('BackgroundTaskInfo interface', () => {
    it('should match Rust response structure', () => {
      // This simulates what comes from Rust backend (camelCase)
      const info: BackgroundTaskInfo = {
        taskId: 'bg_abc123',
        pid: 5678,
        command: 'long running task',
        status: 'running',
        exitCode: undefined,
        startTime: 1700000000000,
        endTime: undefined,
        outputFile: '/data/background/bg_abc123/stdout.log',
        errorFile: '/data/background/bg_abc123/stderr.log',
        maxTimeoutMs: 7200000,
        isTimedOut: false,
      };

      expect(info.taskId).toBe('bg_abc123');
      expect(info.isTimedOut).toBe(false);
    });
  });
});
