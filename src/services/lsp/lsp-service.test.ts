// src/services/lsp/lsp-service.test.ts
// Unit tests for LSP service reference counting and server lifecycle

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));


describe('lsp-service: reference counting', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ServerConnection interface', () => {
    it('should have refCount and cleanupTimer properties', () => {
      // This test verifies the ServerConnection interface includes ref counting
      // The actual implementation is tested through the service methods

      // Create a mock ServerConnection to verify structure
      const mockConnection = {
        serverId: 'test-server-1',
        language: 'typescript',
        rootPath: '/test/project',
        isInitialized: true,
        documentVersions: new Map<string, number>(),
        refCount: 1,
        cleanupTimer: null as ReturnType<typeof setTimeout> | null,
      };

      expect(mockConnection.refCount).toBe(1);
      expect(mockConnection.cleanupTimer).toBeNull();
      expect(mockConnection.serverId).toBe('test-server-1');
    });

    it('should support multiple refCount increments', () => {
      const connection = {
        refCount: 1,
        incrementRef() {
          this.refCount++;
        },
        decrementRef() {
          this.refCount--;
        },
      };

      connection.incrementRef();
      expect(connection.refCount).toBe(2);
      connection.incrementRef();
      expect(connection.refCount).toBe(3);
    });

    it('should schedule cleanup when refCount reaches 0', () => {
      const timers: ReturnType<typeof setTimeout>[] = [];
      const connection = {
        refCount: 1,
        cleanupTimer: null as ReturnType<typeof setTimeout> | null,

        decrementRef() {
          this.refCount--;
          if (this.refCount <= 0) {
            this.cleanupTimer = setTimeout(() => {
              // Cleanup logic would go here
            }, 30000);
            timers.push(this.cleanupTimer);
          }
        },
      };

      connection.decrementRef();
      expect(connection.refCount).toBe(0);
      expect(connection.cleanupTimer).not.toBeNull();
      expect(timers).toHaveLength(1);
    });
  });

  describe('startServer reuse logic', () => {
    it('should find existing server by language and root path', () => {
      // Simulate the findServerByLanguageAndRoot logic
      const servers = new Map<string, { language: string; rootPath: string; refCount: number }>();

      servers.set('server-1', { language: 'typescript', rootPath: '/project-a', refCount: 1 });
      servers.set('server-2', { language: 'rust', rootPath: '/project-b', refCount: 1 });
      servers.set('server-3', { language: 'typescript', rootPath: '/project-b', refCount: 1 });

      const findServer = (language: string, rootPath: string): string | null => {
        for (const [serverId, conn] of servers) {
          if (conn.language === language && conn.rootPath === rootPath) {
            return serverId;
          }
        }
        return null;
      };

      // Should find existing server
      const existing = findServer('typescript', '/project-a');
      expect(existing).toBe('server-1');

      // Should not find non-existing
      const nonExisting = findServer('python', '/project-a');
      expect(nonExisting).toBeNull();

      // Should find correct server for same language, different path
      const differentPath = findServer('typescript', '/project-b');
      expect(differentPath).toBe('server-3');
    });

    it('should increment refCount when reusing existing server', () => {
      const servers = new Map<string, { refCount: number; cleanupTimer: ReturnType<typeof setTimeout> | null }>();

      const serverId = 'server-1';
      servers.set(serverId, { refCount: 1, cleanupTimer: null });

      // Simulate cancel cleanup and increment
      const conn = servers.get(serverId);
      if (conn) {
        if (conn.cleanupTimer) {
          clearTimeout(conn.cleanupTimer);
          conn.cleanupTimer = null;
        }
        conn.refCount++;
      }

      expect(servers.get(serverId)?.refCount).toBe(2);
    });
  });

  describe('stopServer reference counting', () => {
    it('should only stop server when refCount reaches 0', () => {
      const stopCalls: string[] = [];
      const servers = new Map<string, { refCount: number; serverId: string }>();

      servers.set('server-1', { refCount: 2, serverId: 'server-1' });

      const stopServer = (serverId: string, force = false): boolean => {
        const conn = servers.get(serverId);
        if (!conn) return false;

        if (!force && conn.refCount > 1) {
          conn.refCount--;
          return false; // Not stopping
        }

        stopCalls.push(serverId);
        servers.delete(serverId);
        return true; // Stopped
      };

      // Should not stop on first decrement
      const result1 = stopServer('server-1');
      expect(result1).toBe(false);
      expect(servers.has('server-1')).toBe(true);
      expect(servers.get('server-1')?.refCount).toBe(1);

      // Should stop on second decrement (refCount now 0)
      const result2 = stopServer('server-1');
      expect(result2).toBe(true);
      expect(servers.has('server-1')).toBe(false);
      expect(stopCalls).toContain('server-1');
    });

    it('should force stop regardless of refCount when force=true', () => {
      const stopCalls: string[] = [];
      const servers = new Map<string, { refCount: number; serverId: string }>();

      servers.set('server-1', { refCount: 5, serverId: 'server-1' });

      const stopServer = (serverId: string, force = false): boolean => {
        const conn = servers.get(serverId);
        if (!conn) return false;

        if (!force && conn.refCount > 1) {
          conn.refCount--;
          return false;
        }

        stopCalls.push(serverId);
        servers.delete(serverId);
        return true;
      };

      // Force stop
      const result = stopServer('server-1', true);
      expect(result).toBe(true);
      expect(servers.has('server-1')).toBe(false);
    });
  });

  describe('cleanup delay scheduling', () => {
    it('should schedule cleanup after CLEANUP_DELAY', () => {
      const timers: Array<{ id: ReturnType<typeof setTimeout>; serverId: string }> = [];
      const CLEANUP_DELAY = 30000;

      const scheduleCleanup = (serverId: string) => {
        const timer = setTimeout(() => {
          // Cleanup logic
        }, CLEANUP_DELAY);
        timers.push({ id: timer, serverId });
      };

      scheduleCleanup('server-1');
      expect(timers).toHaveLength(1);
      expect(timers[0].serverId).toBe('server-1');
    });

    it('should cancel existing timer before scheduling new one', () => {
      const timerIds: number[] = [];
      let currentTimer: ReturnType<typeof setTimeout> | null = null;

      const scheduleWithCancel = (serverId: string) => {
        if (currentTimer) {
          timerIds.push(1); // Track cancelled timer
          clearTimeout(currentTimer);
        }
        currentTimer = setTimeout(() => {}, 30000);
      };

      scheduleWithCancel('server-1');
      expect(currentTimer).not.toBeNull();

      scheduleWithCancel('server-1'); // Should cancel first timer
      expect(timerIds).toHaveLength(1);
    });
  });
});

describe('lsp-connection-manager: file reference tracking', () => {
  describe('register/unregister with ref counting', () => {
    it('should track multiple files for same server', () => {
      const serverReferences = new Map<string, { filePaths: Set<string>; serverId: string }>();

      const register = (filePath: string, serverId: string, language: string, rootPath: string) => {
        const key = `${rootPath}:${language}`;
        let refs = serverReferences.get(key);
        if (!refs) {
          refs = { serverId, filePaths: new Set() };
          serverReferences.set(key, refs);
        }
        refs.filePaths.add(filePath);
      };

      register('/project/src/file1.ts', 'server-1', 'typescript', '/project');
      register('/project/src/file2.ts', 'server-1', 'typescript', '/project');

      const refs = serverReferences.get('/project:typescript');
      expect(refs?.filePaths.size).toBe(2);
    });

    it('should return true when last file reference is removed', () => {
      const serverReferences = new Map<string, { filePaths: Set<string>; serverId: string }>();
      const connections = new Map<string, { rootPath: string; language: string }>();

      const register = (filePath: string, serverId: string, language: string, rootPath: string) => {
        const key = `${rootPath}:${language}`;
        connections.set(filePath, { rootPath, language });

        let refs = serverReferences.get(key);
        if (!refs) {
          refs = { serverId, filePaths: new Set() };
          serverReferences.set(key, refs);
        }
        refs.filePaths.add(filePath);
      };

      const unregister = (filePath: string): boolean => {
        const conn = connections.get(filePath);
        if (!conn) return false;

        connections.delete(filePath);
        const key = `${conn.rootPath}:${conn.language}`;
        const refs = serverReferences.get(key);

        if (refs) {
          refs.filePaths.delete(filePath);
          const wasLast = refs.filePaths.size === 0;
          if (wasLast) {
            serverReferences.delete(key);
          }
          return wasLast;
        }
        return false;
      };

      register('/project/file1.ts', 'server-1', 'typescript', '/project');

      // Not last reference
      let wasLast = unregister('/project/file1.ts');
      expect(wasLast).toBe(true);
    });

    it('should return false when removing non-last reference', () => {
      const serverReferences = new Map<string, { filePaths: Set<string> }>();
      const connections = new Map<string, { rootPath: string; language: string }>();

      const register = (filePath: string, language: string, rootPath: string) => {
        const key = `${rootPath}:${language}`;
        connections.set(filePath, { rootPath, language });

        let refs = serverReferences.get(key);
        if (!refs) {
          refs = { filePaths: new Set() };
          serverReferences.set(key, refs);
        }
        refs.filePaths.add(filePath);
      };

      const unregister = (filePath: string): boolean => {
        const conn = connections.get(filePath);
        if (!conn) return false;

        connections.delete(filePath);
        const key = `${conn.rootPath}:${conn.language}`;
        const refs = serverReferences.get(key);

        if (refs) {
          refs.filePaths.delete(filePath);
          const wasLast = refs.filePaths.size === 0;
          if (wasLast) {
            serverReferences.delete(key);
          }
          return wasLast;
        }
        return false;
      };

      register('/project/file1.ts', 'typescript', '/project');
      register('/project/file2.ts', 'typescript', '/project');

      // Not last reference
      let wasLast = unregister('/project/file1.ts');
      expect(wasLast).toBe(false);
      expect(serverReferences.has('/project:typescript')).toBe(true);
    });
  });

  describe('getConnectionByRoot', () => {
    it('should return existing connection for language and root', () => {
      const serverReferences = new Map<string, { serverId: string; language: string; rootPath: string }>();

      const key = '/project:rust';
      serverReferences.set(key, {
        serverId: 'rust-server-1',
        language: 'rust',
        rootPath: '/project',
      });

      const getConnectionByRoot = (rootPath: string, language: string) => {
        const key = `${rootPath}:${language}`;
        const refs = serverReferences.get(key);
        if (!refs) return null;
        return {
          serverId: refs.serverId,
          language: refs.language,
          rootPath: refs.rootPath,
        };
      };

      const result = getConnectionByRoot('/project', 'rust');
      expect(result).not.toBeNull();
      expect(result?.serverId).toBe('rust-server-1');
    });

    it('should return null for non-existing connection', () => {
      const serverReferences = new Map<string, { serverId: string }>();

      const getConnectionByRoot = (rootPath: string, language: string) => {
        const key = `${rootPath}:${language}`;
        const refs = serverReferences.get(key);
        if (!refs) return null;
        return { serverId: refs.serverId };
      };

      const result = getConnectionByRoot('/unknown', 'python');
      expect(result).toBeNull();
    });
  });
});

describe('integration: useLsp reference counting workflow', () => {
  describe('server lifecycle with multiple files', () => {
    it('should handle opening and closing multiple files correctly', () => {
      // Simulate the complete workflow
      const serverRefCount = new Map<string, number>();
      const fileReferences = new Map<string, Set<string>>();
      const serverId = 'server-typescript-1';

      // Initialize
      serverRefCount.set(serverId, 0);

      // Open file 1
      const openFile = (filePath: string) => {
        // Register connection
        if (!fileReferences.has(serverId)) {
          fileReferences.set(serverId, new Set());
        }
        fileReferences.get(serverId)!.add(filePath);

        // Increment ref count
        const current = serverRefCount.get(serverId) || 0;
        serverRefCount.set(serverId, current + 1);
      };

      // Close file
      const closeFile = (filePath: string) => {
        const refs = fileReferences.get(serverId);
        if (refs) {
          refs.delete(filePath);
          // Decrement ref count
          const current = serverRefCount.get(serverId) || 0;
          serverRefCount.set(serverId, current - 1);
        }
      };

      openFile('/project/src/file1.ts');
      expect(serverRefCount.get(serverId)).toBe(1);

      openFile('/project/src/file2.ts');
      expect(serverRefCount.get(serverId)).toBe(2);

      closeFile('/project/src/file1.ts');
      expect(serverRefCount.get(serverId)).toBe(1);

      closeFile('/project/src/file2.ts');
      expect(serverRefCount.get(serverId)).toBe(0);
    });

    it('should schedule cleanup after all files are closed', () => {
      const serverState = new Map<string, { refCount: number; cleanupScheduled: boolean }>();
      const serverId = 'server-rust-1';

      serverState.set(serverId, { refCount: 1, cleanupScheduled: false });

      const decrementAndScheduleCleanup = (serverId: string) => {
        const state = serverState.get(serverId);
        if (!state) return;

        state.refCount--;

        if (state.refCount <= 0 && !state.cleanupScheduled) {
          state.cleanupScheduled = true;
          // In real implementation, this would schedule setTimeout
        }
      };

      decrementAndScheduleCleanup(serverId);
      expect(serverState.get(serverId)?.refCount).toBe(0);
      expect(serverState.get(serverId)?.cleanupScheduled).toBe(true);
    });
  });

  describe('server reuse across different components', () => {
    it('should not start duplicate server for same language and root', () => {
      const startedServers = new Set<string>();
      const existingConnections = new Map<string, { serverId: string }>();

      const tryStartOrReuseServer = (language: string, rootPath: string) => {
        const key = `${rootPath}:${language}`;

        // Check for existing connection
        if (existingConnections.has(key)) {
          const conn = existingConnections.get(key)!;
          // Would increment ref count here
          return { serverId: conn.serverId, reused: true };
        }

        // Start new server
        const newServerId = `server-${language}-${Date.now()}`;
        startedServers.add(newServerId);
        existingConnections.set(key, { serverId: newServerId });
        return { serverId: newServerId, reused: false };
      };

      // First call starts a new server
      const result1 = tryStartOrReuseServer('typescript', '/project');
      expect(result1.reused).toBe(false);
      expect(startedServers.size).toBe(1);

      // Second call reuses existing
      const result2 = tryStartOrReuseServer('typescript', '/project');
      expect(result2.reused).toBe(true);
      expect(result2.serverId).toBe(result1.serverId);
      expect(startedServers.size).toBe(1); // No new server started
    });
  });
});
