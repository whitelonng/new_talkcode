/**
 * Test Context Factory
 *
 * Provides convenient functions to create and manage test environments.
 */

import { afterEach, beforeEach } from 'vitest';
import type { TestDatabaseAdapter } from './adapters/test-database-adapter';
import type { TestFileSystemAdapter } from './adapters/test-file-system-adapter';
import type { TestShellAdapter } from './adapters/test-shell-adapter';
import { type TestEnvironmentConfig, TestIPCHandler } from './test-ipc-handler';

export interface TestContext {
  /** The IPC handler instance */
  ipc: TestIPCHandler;
  /** Direct access to the database adapter */
  db: TestDatabaseAdapter;
  /** Direct access to the file system adapter */
  fs: TestFileSystemAdapter;
  /** Direct access to the shell adapter */
  shell: TestShellAdapter;
}

/**
 * Create a test context that automatically sets up before each test
 * and tears down after each test.
 *
 * @example
 * ```typescript
 * describe('TaskService', () => {
 *   const ctx = createTestContext({
 *     database: { enableLogging: true }
 *   });
 *
 *   it('should create task', async () => {
 *     // ctx.db, ctx.fs, ctx.shell are available
 *     const rows = ctx.db.rawQuery('SELECT * FROM conversations');
 *     expect(rows).toHaveLength(0);
 *   });
 * });
 * ```
 */
export function createTestContext(config?: TestEnvironmentConfig): TestContext {
  let ipc: TestIPCHandler;

  // Create a proxy object that will be populated during beforeEach
  const context: TestContext = {
    get ipc() {
      return ipc;
    },
    get db() {
      return ipc.getDatabase();
    },
    get fs() {
      return ipc.getFileSystem();
    },
    get shell() {
      return ipc.getShell();
    },
  };

  beforeEach(() => {
    ipc = new TestIPCHandler(config);
    ipc.setup();
  });

  afterEach(() => {
    ipc.teardown();
  });

  return context;
}

/**
 * Run a function with a test environment.
 * Useful for one-off tests that don't need a full describe block.
 *
 * @example
 * ```typescript
 * it('should work', async () => {
 *   await withTestEnvironment({}, async (ctx) => {
 *     ctx.db.rawExecute('INSERT INTO projects ...');
 *     // test logic
 *   });
 * });
 * ```
 */
export async function withTestEnvironment<T>(
  config: TestEnvironmentConfig,
  fn: (ctx: TestContext) => Promise<T>
): Promise<T> {
  const ipc = new TestIPCHandler(config);
  ipc.setup();

  try {
    const ctx: TestContext = {
      ipc,
      db: ipc.getDatabase(),
      fs: ipc.getFileSystem(),
      shell: ipc.getShell(),
    };
    return await fn(ctx);
  } finally {
    ipc.teardown();
  }
}

/**
 * Create a test context without automatic lifecycle hooks.
 * Caller is responsible for calling setup() and teardown().
 *
 * @example
 * ```typescript
 * const ctx = createManualTestContext({});
 * ctx.ipc.setup();
 * // ... tests
 * ctx.ipc.teardown();
 * ```
 */
export function createManualTestContext(config?: TestEnvironmentConfig): TestContext {
  const ipc = new TestIPCHandler(config);

  return {
    ipc,
    get db() {
      return ipc.getDatabase();
    },
    get fs() {
      return ipc.getFileSystem();
    },
    get shell() {
      return ipc.getShell();
    },
  };
}

/**
 * Create a database-only test context.
 * Useful for pure database tests that don't need file system or shell.
 *
 * @example
 * ```typescript
 * describe('TaskService', () => {
 *   const db = createDatabaseTestContext();
 *
 *   it('should create task', () => {
 *     db.rawExecute('INSERT INTO ...');
 *     const rows = db.rawQuery('SELECT * FROM ...');
 *   });
 * });
 * ```
 */
export function createDatabaseTestContext(
  config?: TestEnvironmentConfig['database']
): TestDatabaseAdapter {
  // Import dynamically to avoid circular dependencies
  const { TestDatabaseAdapter } = require('./adapters/test-database-adapter');

  let db: TestDatabaseAdapter;

  beforeEach(() => {
    db = new TestDatabaseAdapter(config);
  });

  afterEach(() => {
    db.close();
  });

  // Return a proxy that forwards to the current db instance
  return new Proxy({} as TestDatabaseAdapter, {
    get(_target, prop) {
      return (db as unknown as Record<string, unknown>)[prop as string];
    },
  });
}

/**
 * Create a file system-only test context.
 * Useful for pure file system tests.
 */
export function createFileSystemTestContext(
  config?: TestEnvironmentConfig['fileSystem']
): TestFileSystemAdapter {
  const { TestFileSystemAdapter } = require('./adapters/test-file-system-adapter');

  let fs: TestFileSystemAdapter;

  beforeEach(() => {
    fs = new TestFileSystemAdapter(config);
  });

  afterEach(() => {
    fs.cleanup();
  });

  return new Proxy({} as TestFileSystemAdapter, {
    get(_target, prop) {
      return (fs as unknown as Record<string, unknown>)[prop as string];
    },
  });
}
