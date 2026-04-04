import type { Terminal } from '@xterm/xterm';
import { create } from 'zustand';

export interface TerminalSession {
  id: string;
  ptyId: string;
  title: string;
  cwd?: string;
  terminal?: Terminal;
  buffer: string; // Store all output for "copy to chat" feature
  isActive: boolean;
  createdAt: Date;
}

interface TerminalState {
  // State
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
  isTerminalVisible: boolean;
  autoCreateAllowed: boolean;

  // Actions
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<TerminalSession>) => void;
  setActiveSession: (id: string | null) => void;
  appendToBuffer: (id: string, data: string) => void;
  clearBuffer: (id: string) => void;
  getSession: (id: string) => TerminalSession | undefined;
  getActiveSession: () => TerminalSession | undefined;
  getAllSessions: () => TerminalSession[];
  setTerminalVisible: (visible: boolean) => void;
  toggleTerminalVisible: () => void;
  selectNextSession: () => void;
  selectPreviousSession: () => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,
  isTerminalVisible: false,
  autoCreateAllowed: true,

  addSession: (session) =>
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(session.id, session);
      return {
        sessions: newSessions,
        activeSessionId: session.id,
        autoCreateAllowed: false,
      };
    }),

  removeSession: (id) =>
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(id);

      // If removing active session, select another one
      let newActiveId: string | null = state.activeSessionId;
      if (state.activeSessionId === id) {
        const remainingSessions = Array.from(newSessions.keys());
        newActiveId = remainingSessions.length > 0 ? (remainingSessions[0] ?? null) : null;
      }

      const isEmpty = newSessions.size === 0;

      return {
        sessions: newSessions,
        activeSessionId: newActiveId,
        autoCreateAllowed: isEmpty ? false : state.autoCreateAllowed,
      };
    }),

  updateSession: (id, updates) =>
    set((state) => {
      const session = state.sessions.get(id);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(id, { ...session, ...updates });
      return { sessions: newSessions };
    }),

  setActiveSession: (id) =>
    set(() => ({
      activeSessionId: id,
    })),

  appendToBuffer: (id, data) =>
    set((state) => {
      const session = state.sessions.get(id);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(id, {
        ...session,
        buffer: session.buffer + data,
      });
      return { sessions: newSessions };
    }),

  clearBuffer: (id) =>
    set((state) => {
      const session = state.sessions.get(id);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(id, {
        ...session,
        buffer: '',
      });
      return { sessions: newSessions };
    }),

  getSession: (id) => {
    return get().sessions.get(id);
  },

  getActiveSession: () => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return undefined;
    return sessions.get(activeSessionId);
  },

  getAllSessions: () => {
    return Array.from(get().sessions.values());
  },

  setTerminalVisible: (visible) =>
    set(() => ({
      isTerminalVisible: visible,
      autoCreateAllowed: visible,
    })),

  toggleTerminalVisible: () =>
    set((state) => ({
      isTerminalVisible: !state.isTerminalVisible,
      autoCreateAllowed: !state.isTerminalVisible,
    })),

  selectNextSession: () =>
    set((state) => {
      const sessionIds = Array.from(state.sessions.keys());
      if (sessionIds.length <= 1) return state;

      const currentIndex = state.activeSessionId ? sessionIds.indexOf(state.activeSessionId) : -1;
      const nextIndex = (currentIndex + 1) % sessionIds.length;
      const nextSessionId = sessionIds[nextIndex];

      return {
        activeSessionId: nextSessionId ?? null,
      };
    }),

  selectPreviousSession: () =>
    set((state) => {
      const sessionIds = Array.from(state.sessions.keys());
      if (sessionIds.length <= 1) return state;

      const currentIndex = state.activeSessionId ? sessionIds.indexOf(state.activeSessionId) : -1;
      const previousIndex = currentIndex <= 0 ? sessionIds.length - 1 : currentIndex - 1;
      const previousSessionId = sessionIds[previousIndex];

      return {
        activeSessionId: previousSessionId ?? null,
      };
    }),
}));
