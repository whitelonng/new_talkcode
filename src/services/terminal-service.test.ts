import { beforeEach, describe, expect, it, vi } from 'vitest';
import { terminalService } from './terminal-service';
import { useTerminalStore } from '@/stores/terminal-store';
import type { Terminal } from '@xterm/xterm';
import { invoke } from '@tauri-apps/api/core';

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));


vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getTerminalShell: vi.fn(() => 'auto'),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn(),
  },
}));

describe('TerminalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the terminal store
    useTerminalStore.getState().sessions.clear();
    // Clear pending outputs
    (terminalService as any).pendingOutputs.clear();
  });

  describe('getRecentCommands', () => {
    it('should strip ANSI escape codes from terminal output', () => {
      // Create a mock session with ANSI codes in buffer
      const sessionId = 'test-session-1';
      const bufferWithAnsi = '\x1b[33mYellow text\x1b[0m\nNormal text\n\x1b[31mRed text\x1b[0m';

      // Add session to store
      useTerminalStore.getState().addSession({
        id: sessionId,
        ptyId: 'pty-1',
        title: 'Test Terminal',
        buffer: bufferWithAnsi,
        isActive: true,
        createdAt: new Date(),
      });

      const result = terminalService.getRecentCommands(sessionId);

      // Should have ANSI codes stripped
      expect(result).toBe('Yellow text\nNormal text\nRed text');
      expect(result).not.toContain('\x1b[33m');
      expect(result).not.toContain('\x1b[31m');
      expect(result).not.toContain('\x1b[0m');
    });

    it('should handle Chinese characters correctly', () => {
      const sessionId = 'test-session-2';
      const bufferWithChineseAndAnsi = '\x1b[33m测试\x1b[0m中文字符\n\x1b[32m你好世界\x1b[0m';

      useTerminalStore.getState().addSession({
        id: sessionId,
        ptyId: 'pty-2',
        title: 'Test Terminal',
        buffer: bufferWithChineseAndAnsi,
        isActive: true,
        createdAt: new Date(),
      });

      const result = terminalService.getRecentCommands(sessionId);

      // Chinese characters should be preserved
      expect(result).toBe('测试中文字符\n你好世界');
      expect(result).toContain('测试');
      expect(result).toContain('中文字符');
      expect(result).toContain('你好世界');
      // ANSI codes should be removed
      expect(result).not.toContain('\x1b[33m');
      expect(result).not.toContain('\x1b[32m');
      expect(result).not.toContain('\x1b[0m');
    });

    it('should handle mixed English and Chinese with ANSI codes', () => {
      const sessionId = 'test-session-3';
      const bufferMixed =
        '\x1b[36mFile: \x1b[0mtest.ts\n\x1b[33m警告: \x1b[0mWarning message\n\x1b[31m错误: \x1b[0mError occurred';

      useTerminalStore.getState().addSession({
        id: sessionId,
        ptyId: 'pty-3',
        title: 'Test Terminal',
        buffer: bufferMixed,
        isActive: true,
        createdAt: new Date(),
      });

      const result = terminalService.getRecentCommands(sessionId);

      expect(result).toBe('File: test.ts\n警告: Warning message\n错误: Error occurred');
      expect(result).toContain('File: test.ts');
      expect(result).toContain('警告: Warning message');
      expect(result).toContain('错误: Error occurred');
    });

    it('should limit the number of lines returned', () => {
      const sessionId = 'test-session-4';
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      const buffer = lines.join('\n');

      useTerminalStore.getState().addSession({
        id: sessionId,
        ptyId: 'pty-4',
        title: 'Test Terminal',
        buffer,
        isActive: true,
        createdAt: new Date(),
      });

      const result = terminalService.getRecentCommands(sessionId, 10);
      const resultLines = result.split('\n');

      expect(resultLines.length).toBe(10);
      expect(resultLines[0]).toBe('Line 91');
      expect(resultLines[9]).toBe('Line 100');
    });

    it('should return empty string for non-existent session', () => {
      const result = terminalService.getRecentCommands('non-existent-session');
      expect(result).toBe('');
    });

    it('should handle complex ANSI sequences', () => {
      const sessionId = 'test-session-5';
      // Complex ANSI sequences including cursor movements, colors, and formatting
      const complexBuffer =
        '\x1b[2J\x1b[H\x1b[1;32mSuccess\x1b[0m\n\x1b[4;31mUnderlined Red\x1b[0m\n\x1b[7;34mInverted Blue\x1b[0m';

      useTerminalStore.getState().addSession({
        id: sessionId,
        ptyId: 'pty-5',
        title: 'Test Terminal',
        buffer: complexBuffer,
        isActive: true,
        createdAt: new Date(),
      });

      const result = terminalService.getRecentCommands(sessionId);

      // All ANSI codes should be stripped, leaving only the text
      expect(result).toBe('Success\nUnderlined Red\nInverted Blue');
      expect(result).not.toMatch(/\x1b\[[0-9;]*m/);
    });
  });

  describe('attachTerminal', () => {
    it('should write buffered output when terminal is attached', () => {
      const sessionId = 'test-session-attach';
      const bufferedData = 'user@host:/path$ ';

      // Create a session with buffered data (simulating output that arrived before terminal was ready)
      useTerminalStore.getState().addSession({
        id: sessionId,
        ptyId: 'pty-attach',
        title: 'Test Terminal',
        buffer: bufferedData,
        isActive: true,
        createdAt: new Date(),
      });

      // Create a mock terminal
      const mockTerminal = {
        write: vi.fn(),
        onData: vi.fn(() => ({ dispose: vi.fn() })),
      } as unknown as Terminal;

      // Attach the terminal
      terminalService.attachTerminal(sessionId, mockTerminal);

      // Verify buffered data was written to terminal
      expect(mockTerminal.write).toHaveBeenCalledWith(bufferedData);
    });

    it('should handle empty buffer on attach', () => {
      const sessionId = 'test-session-empty';

      // Create a session with no buffered data
      useTerminalStore.getState().addSession({
        id: sessionId,
        ptyId: 'pty-empty',
        title: 'Test Terminal',
        buffer: '',
        isActive: true,
        createdAt: new Date(),
      });

      const mockTerminal = {
        write: vi.fn(),
        onData: vi.fn(() => ({ dispose: vi.fn() })),
      } as unknown as Terminal;

      terminalService.attachTerminal(sessionId, mockTerminal);

      // Empty buffer should not trigger write
      expect(mockTerminal.write).not.toHaveBeenCalled();
    });

    it('should write buffered output with shell prompt and Chinese characters', () => {
      const sessionId = 'test-session-chinese';
      const bufferedData = '\x1b[32muser@host\x1b[0m:\x1b[34m~/项目/talkcody\x1b[0m$ ';

      useTerminalStore.getState().addSession({
        id: sessionId,
        ptyId: 'pty-chinese',
        title: 'Test Terminal',
        buffer: bufferedData,
        isActive: true,
        createdAt: new Date(),
      });

      const mockTerminal = {
        write: vi.fn(),
        onData: vi.fn(() => ({ dispose: vi.fn() })),
      } as unknown as Terminal;

      terminalService.attachTerminal(sessionId, mockTerminal);

      // Verify the buffered data (with ANSI codes) was written to terminal
      // XTerm will handle the ANSI codes for display
      expect(mockTerminal.write).toHaveBeenCalledWith(bufferedData);
      expect(mockTerminal.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('pendingOutputs race condition fix', () => {
    it('should buffer PTY output when session does not exist yet', () => {
      const ptyId = 'pty-race-1';
      const earlyOutput = 'PS C:\\Users\\test> ';

      // Simulate PTY output arriving before session is created
      // This happens on Windows where ConPTY emits data before invoke returns
      (terminalService as any).handlePtyOutput(ptyId, earlyOutput);

      // Verify output was buffered
      const pendingOutputs = (terminalService as any).pendingOutputs;
      expect(pendingOutputs.has(ptyId)).toBe(true);
      expect(pendingOutputs.get(ptyId)).toEqual([earlyOutput]);
    });

    it('should buffer multiple early outputs in order', () => {
      const ptyId = 'pty-race-2';
      const output1 = 'First chunk';
      const output2 = 'Second chunk';
      const output3 = 'Third chunk';

      // Simulate multiple PTY outputs arriving before session is created
      (terminalService as any).handlePtyOutput(ptyId, output1);
      (terminalService as any).handlePtyOutput(ptyId, output2);
      (terminalService as any).handlePtyOutput(ptyId, output3);

      // Verify all outputs were buffered in order
      const pendingOutputs = (terminalService as any).pendingOutputs;
      expect(pendingOutputs.get(ptyId)).toEqual([output1, output2, output3]);
    });

    it('should flush pending outputs after session creation', async () => {
      const ptyId = 'pty-race-3';
      const earlyOutput = 'Early output before session';

      // Mock invoke to return a valid pty_id
      (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ pty_id: ptyId });

      // Simulate early PTY output
      (terminalService as any).handlePtyOutput(ptyId, earlyOutput);

      // Verify output is buffered
      expect((terminalService as any).pendingOutputs.has(ptyId)).toBe(true);

      // Create the terminal (this should trigger flush)
      const session = await terminalService.createTerminal('/test/path');

      // Pending outputs should be cleared immediately (moved to flush queue)
      expect((terminalService as any).pendingOutputs.has(ptyId)).toBe(false);

      // Wait for the delayed flush (setTimeout 50ms in the implementation + some buffer)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the session buffer now contains the early output
      const store = useTerminalStore.getState();
      const updatedSession = store.getSession(session.id);
      expect(updatedSession?.buffer).toContain(earlyOutput);
    });

    it('should handle normal output flow when session exists', () => {
      const sessionId = 'test-session-normal';
      const ptyId = 'pty-normal';
      const normalOutput = 'Normal output after session exists';

      // Create session first (normal flow)
      useTerminalStore.getState().addSession({
        id: sessionId,
        ptyId: ptyId,
        title: 'Test Terminal',
        buffer: '',
        isActive: true,
        createdAt: new Date(),
      });

      // Simulate PTY output after session exists
      (terminalService as any).handlePtyOutput(ptyId, normalOutput);

      // Verify output was NOT buffered (went directly to session)
      expect((terminalService as any).pendingOutputs.has(ptyId)).toBe(false);

      // Verify output was appended to session buffer
      const store = useTerminalStore.getState();
      const session = store.getSession(sessionId);
      expect(session?.buffer).toBe(normalOutput);
    });

    it('should clear pending outputs on cleanup', async () => {
      const ptyId1 = 'pty-cleanup-1';
      const ptyId2 = 'pty-cleanup-2';

      // Buffer some early outputs
      (terminalService as any).handlePtyOutput(ptyId1, 'Output 1');
      (terminalService as any).handlePtyOutput(ptyId2, 'Output 2');

      // Verify they are buffered
      expect((terminalService as any).pendingOutputs.size).toBe(2);

      // Call cleanup
      await terminalService.cleanup();

      // Verify pending outputs are cleared
      expect((terminalService as any).pendingOutputs.size).toBe(0);
    });

    it('should handle Windows ConPTY 4-byte initial output scenario', async () => {
      const ptyId = 'pty-windows-conpty';
      // Simulate the 4-byte ConPTY initialization data
      const conptyInitData = '\x00\x00\x00\x00';
      const shellPrompt = 'PS C:\\> ';

      // Mock invoke
      (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ pty_id: ptyId });

      // Simulate ConPTY sending initial bytes before invoke returns
      (terminalService as any).handlePtyOutput(ptyId, conptyInitData);
      (terminalService as any).handlePtyOutput(ptyId, shellPrompt);

      // Both should be buffered
      expect((terminalService as any).pendingOutputs.get(ptyId)).toEqual([
        conptyInitData,
        shellPrompt,
      ]);

      // Create terminal
      const session = await terminalService.createTerminal('C:\\Users\\test');

      // Wait for the delayed flush
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify both outputs were flushed to session buffer
      const store = useTerminalStore.getState();
      const updatedSession = store.getSession(session.id);
      expect(updatedSession?.buffer).toContain(conptyInitData);
      expect(updatedSession?.buffer).toContain(shellPrompt);
    });
  });
});
