import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { terminalService } from '@/services/terminal-service';
import { useTerminalStore } from '@/stores/terminal-store';
import { useRepositoryStore } from '@/stores/window-scoped-repository-store';
import { Terminal } from './terminal';
import { TerminalTabs } from './terminal-tabs';

interface TerminalPanelProps {
  onCopyToChat?: (content: string) => void;
}

export function TerminalPanel({ onCopyToChat: _onCopyToChat }: TerminalPanelProps) {
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const sessions = useTerminalStore((state) => state.sessions);
  const autoCreateAllowed = useTerminalStore((state) => state.autoCreateAllowed);
  const rootPath = useRepositoryStore((state) => state.rootPath);
  const isCreatingTerminal = useRef(false);

  useEffect(() => {
    // Create initial terminal if none exist
    if (sessions.size === 0 && autoCreateAllowed && !isCreatingTerminal.current) {
      logger.info('Creating initial terminal', {
        sessionsSize: sessions.size,
        rootPath,
        autoCreateAllowed,
        isCreating: isCreatingTerminal.current,
      });
      isCreatingTerminal.current = true;
      terminalService
        .createTerminal(rootPath || undefined)
        .catch((error) => {
          logger.error('Failed to create initial terminal', error);
        })
        .finally(() => {
          isCreatingTerminal.current = false;
        });
    }
  }, [sessions.size, rootPath, autoCreateAllowed]);

  return (
    <div className="flex h-full flex-col bg-background pb-1">
      <div className="border-b bg-muted/20 px-2 py-1">
        <TerminalTabs />
      </div>

      <div className="flex-1 overflow-hidden">
        {activeSessionId ? (
          <Terminal sessionId={activeSessionId} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No terminal sessions
          </div>
        )}
      </div>
    </div>
  );
}
