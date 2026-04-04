import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { TerminalPanel } from './terminal-panel';
import { useTerminalStore } from '@/stores/terminal-store';
import { terminalService } from '@/services/terminal-service';

vi.mock('./terminal', () => ({
  Terminal: () => <div data-testid="terminal" />,
}));

vi.mock('./terminal-tabs', () => ({
  TerminalTabs: () => <div data-testid="terminal-tabs" />,
}));

vi.mock('@/stores/window-scoped-repository-store', () => ({
  useRepositoryStore: vi.fn((selector) => {
    const state = { rootPath: '/test/root' };
    return selector(state);
  }),
}));

vi.mock('@/services/terminal-service', () => ({
  terminalService: {
    createTerminal: vi.fn(() => Promise.resolve({
      id: 'session-1',
      ptyId: 'pty-1',
      title: 'Terminal',
      buffer: '',
      isActive: true,
      createdAt: new Date(),
    })),
  },
}));

describe('TerminalPanel auto-create behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTerminalStore.setState({
      sessions: new Map(),
      activeSessionId: null,
      isTerminalVisible: false,
      autoCreateAllowed: true,
    });
  });

  it('should create a terminal when visible with no sessions', async () => {
    useTerminalStore.getState().setTerminalVisible(true);

    render(<TerminalPanel />);

    await waitFor(() => {
      expect(terminalService.createTerminal).toHaveBeenCalledTimes(1);
    });
  });

  it('should not create a terminal when auto-create is suppressed', async () => {
    useTerminalStore.setState({
      sessions: new Map(),
      activeSessionId: null,
      isTerminalVisible: true,
      autoCreateAllowed: false,
    });

    render(<TerminalPanel />);

    await waitFor(() => {
      expect(terminalService.createTerminal).not.toHaveBeenCalled();
    });
  });
});
