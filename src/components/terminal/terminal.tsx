import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { ITheme } from '@xterm/xterm';
import { Terminal as XTerm } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { logger } from '@/lib/logger';
import { terminalService } from '@/services/terminal-service';
import { useSettingsStore } from '@/stores/settings-store';
import { useTerminalStore } from '@/stores/terminal-store';

// Terminal themes
const darkTheme: ITheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff',
};

const lightTheme: ITheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#333333',
  black: '#000000',
  red: '#cd3131',
  green: '#00bc00',
  yellow: '#949800',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#14ce14',
  brightYellow: '#b5ba00',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#a5a5a5',
};

interface TerminalProps {
  sessionId: string;
}

export function Terminal({ sessionId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isAttachedRef = useRef(false);

  // Get font settings from store
  const terminalFont = useSettingsStore((state) => state.terminal_font);
  const terminalFontSize = useSettingsStore((state) => state.terminal_font_size);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    // Prevent duplicate initialization in this component instance
    if (isAttachedRef.current) {
      logger.info('Terminal already initialized in this component', { sessionId });
      return;
    }

    // Get session from store
    const session = useTerminalStore.getState().getSession(sessionId);
    if (!session) {
      return;
    }

    // Mark as attached for this component instance
    isAttachedRef.current = true;

    logger.info('Creating new XTerm instance', { sessionId });

    // Detect theme - check if document has dark class
    const isDarkMode = document.documentElement.classList.contains('dark');
    const theme = isDarkMode ? darkTheme : lightTheme;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: terminalFontSize || 14,
      fontFamily:
        terminalFont ||
        'Menlo, Monaco, "DejaVu Sans Mono", "Ubuntu Mono", "Liberation Mono", "Droid Sans Mono", "Courier New", monospace',
      theme,
      allowTransparency: false,
      scrollback: 10000,
      convertEol: true,
      allowProposedApi: true,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(searchAddon);

    // Open terminal
    xterm.open(terminalRef.current);

    // Fit to container
    fitAddon.fit();

    // Store references
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Attach to service
    terminalService.attachTerminal(sessionId, xterm);

    logger.info('Terminal component mounted', { sessionId });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = xterm;
        const currentSession = useTerminalStore.getState().getSession(sessionId);
        if (currentSession) {
          terminalService.resizeTerminal(currentSession.ptyId, cols, rows);
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Initial fit and focus after a short delay
    setTimeout(() => {
      handleResize();
      xterm.focus();
    }, 100);

    // Cleanup
    return () => {
      logger.info('Terminal component unmounting', { sessionId });
      resizeObserver.disconnect();
      terminalService.detachTerminal(sessionId);
      xterm.dispose();
      isAttachedRef.current = false;
    };
  }, [sessionId, terminalFont, terminalFontSize]); // Add font settings as dependencies

  // Check if session exists for rendering
  const session = useTerminalStore((state) => state.sessions.get(sessionId));

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Terminal session not found
      </div>
    );
  }

  return <div ref={terminalRef} className="h-full w-full p-1" />;
}
