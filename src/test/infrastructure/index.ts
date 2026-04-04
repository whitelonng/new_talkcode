/**
 * Test Infrastructure
 *
 * Provides a unified testing framework for Talkcody:
 * - mockIPC: Intercepts Tauri IPC calls
 * - Real database: Uses bun:sqlite in memory mode
 * - Real file system: Uses temp directory for file operations
 * - Shell mock: Simulates shell command responses
 */

export type { DatabaseConfig, ResultSet } from './adapters/test-database-adapter';
export { TestDatabaseAdapter } from './adapters/test-database-adapter';
export type { FileSystemConfig } from './adapters/test-file-system-adapter';
export { TestFileSystemAdapter } from './adapters/test-file-system-adapter';
export type { ShellConfig, ShellResult } from './adapters/test-shell-adapter';
export { TestShellAdapter } from './adapters/test-shell-adapter';
export type { TestContext } from './test-context';
export { createTestContext, withTestEnvironment } from './test-context';
export type { IPCCommandHandler, TestEnvironmentConfig } from './test-ipc-handler';
export { TestIPCHandler } from './test-ipc-handler';
