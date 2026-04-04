/**
 * Test Shell Adapter
 *
 * Simulates shell command execution for testing.
 * Provides configurable responses and execution history tracking.
 */

export interface ShellConfig {
  /** Default responses for specific commands or patterns */
  defaultResponses?: Record<string, Partial<ShellResult>>;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  code: number;
  timed_out: boolean;
  idle_timed_out: boolean;
  pid: number | null;
}

export interface ExecutionRecord {
  command: string;
  cwd?: string;
  result: ShellResult;
  timestamp: number;
}

export class TestShellAdapter {
  private responses: Map<string, ShellResult>;
  private executionHistory: ExecutionRecord[];
  private defaultResult: ShellResult;

  constructor(config: ShellConfig = {}) {
    this.responses = new Map();
    this.executionHistory = [];

    // Default result for unregistered commands
    this.defaultResult = {
      stdout: '',
      stderr: '',
      code: 0,
      timed_out: false,
      idle_timed_out: false,
      pid: null,
    };

    // Register configured responses
    if (config.defaultResponses) {
      for (const [pattern, result] of Object.entries(config.defaultResponses)) {
        this.setResponse(pattern, result);
      }
    }

    // Register common git commands
    this.registerCommonCommands();
  }

  /**
   * Register a response for a command pattern
   */
  setResponse(commandPattern: string, result: Partial<ShellResult>): void {
    this.responses.set(commandPattern, {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      code: result.code ?? 0,
      timed_out: result.timed_out ?? false,
      idle_timed_out: result.idle_timed_out ?? false,
      pid: result.pid ?? Math.floor(Math.random() * 100000),
    });
  }

  /**
   * Handle execute_user_shell command
   */
  execute(args: { command: string; cwd?: string; timeoutMs?: number }): ShellResult {
    const { command, cwd } = args;

    // Check for exact match first
    if (this.responses.has(command)) {
      const result = this.responses.get(command)!;
      this.recordExecution(command, cwd, result);
      return result;
    }

    // Check for pattern match (command starts with or contains pattern)
    for (const [pattern, result] of Array.from(this.responses.entries())) {
      // Exact prefix match
      if (command.startsWith(pattern)) {
        this.recordExecution(command, cwd, result);
        return result;
      }

      // Regex pattern match (patterns starting with ^)
      if (pattern.startsWith('^') || pattern.includes('.*')) {
        try {
          if (new RegExp(pattern).test(command)) {
            this.recordExecution(command, cwd, result);
            return result;
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }

    // Use default result for unregistered commands
    const result = { ...this.defaultResult, pid: Math.floor(Math.random() * 100000) };
    this.recordExecution(command, cwd, result);
    return result;
  }

  /**
   * Set result for error scenario
   */
  setErrorResponse(commandPattern: string, stderr: string, code = 1): void {
    this.setResponse(commandPattern, {
      stdout: '',
      stderr,
      code,
    });
  }

  /**
   * Set result for timeout scenario
   */
  setTimeoutResponse(commandPattern: string): void {
    this.setResponse(commandPattern, {
      stdout: '',
      stderr: 'Command timed out',
      code: 124,
      timed_out: true,
    });
  }

  // ============================================
  // Test utility methods
  // ============================================

  /**
   * Get all execution history
   */
  getExecutionHistory(): ExecutionRecord[] {
    return [...this.executionHistory];
  }

  /**
   * Get the last executed command
   */
  getLastCommand(): string | undefined {
    return this.executionHistory[this.executionHistory.length - 1]?.command;
  }

  /**
   * Get execution count for a command pattern
   */
  getExecutionCount(pattern: string | RegExp): number {
    return this.executionHistory.filter(({ command }) =>
      typeof pattern === 'string' ? command.includes(pattern) : pattern.test(command)
    ).length;
  }

  /**
   * Check if a command was executed
   */
  wasCommandExecuted(pattern: string | RegExp): boolean {
    return this.executionHistory.some(({ command }) =>
      typeof pattern === 'string' ? command.includes(pattern) : pattern.test(command)
    );
  }

  /**
   * Get executions matching a pattern
   */
  getExecutions(pattern: string | RegExp): ExecutionRecord[] {
    return this.executionHistory.filter(({ command }) =>
      typeof pattern === 'string' ? command.includes(pattern) : pattern.test(command)
    );
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Reset all responses to defaults
   */
  reset(): void {
    this.responses.clear();
    this.executionHistory = [];
    this.registerCommonCommands();
  }

  // ============================================
  // Private helpers
  // ============================================

  /**
   * Record command execution
   */
  private recordExecution(command: string, cwd: string | undefined, result: ShellResult): void {
    this.executionHistory.push({
      command,
      cwd,
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Register common command responses
   */
  private registerCommonCommands(): void {
    // Git commands
    this.setResponse('git rev-parse --is-inside-work-tree', {
      stdout: 'true\n',
      code: 0,
    });

    this.setResponse('git status', {
      stdout: 'On branch main\nnothing to commit, working tree clean\n',
      code: 0,
    });

    this.setResponse('git branch --show-current', {
      stdout: 'main\n',
      code: 0,
    });

    this.setResponse('git log', {
      stdout:
        'commit abc123\nAuthor: Test <test@example.com>\nDate: Mon Jan 1 00:00:00 2024\n\n    Initial commit\n',
      code: 0,
    });

    // Common shell commands
    this.setResponse('pwd', {
      stdout: '/test/project\n',
      code: 0,
    });

    this.setResponse('whoami', {
      stdout: 'testuser\n',
      code: 0,
    });

    this.setResponse('echo', {
      stdout: '\n',
      code: 0,
    });

    // Node/npm commands
    this.setResponse('node --version', {
      stdout: 'v20.0.0\n',
      code: 0,
    });

    this.setResponse('npm --version', {
      stdout: '10.0.0\n',
      code: 0,
    });

    this.setResponse('bun --version', {
      stdout: '1.0.0\n',
      code: 0,
    });
  }
}
