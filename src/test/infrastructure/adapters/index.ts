/**
 * Test Adapters
 *
 * Adapters that implement real or simulated behavior for various system components.
 */

export type { DatabaseConfig, ResultSet } from './test-database-adapter';
export { TestDatabaseAdapter, TursoClientAdapter } from './test-database-adapter';
export type { FileSystemConfig } from './test-file-system-adapter';
export { TestFileSystemAdapter } from './test-file-system-adapter';
export type { ShellConfig, ShellResult } from './test-shell-adapter';
export { TestShellAdapter } from './test-shell-adapter';
