import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { terminalService } from '@/services/terminal-service';
import { useTerminalStore } from '@/stores/terminal-store';
import { useRepositoryStore } from '@/stores/window-scoped-repository-store';

export function TerminalTabs() {
  const sessions = useTerminalStore((state) => state.sessions);
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const setActiveSession = useTerminalStore((state) => state.setActiveSession);
  const setTerminalVisible = useTerminalStore((state) => state.setTerminalVisible);
  const rootPath = useRepositoryStore((state) => state.rootPath);

  // Convert Map to Array for rendering
  const sessionArray = Array.from(sessions.values());

  const handleNewTerminal = async () => {
    try {
      setTerminalVisible(true);
      await terminalService.createTerminal(rootPath || undefined);
    } catch (error) {
      logger.error('Failed to create new terminal', error);
    }
  };

  const handleCloseTerminal = async (ptyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await terminalService.killTerminal(ptyId);
    } catch (error) {
      logger.error('Failed to close terminal', error);
    }
  };

  return (
    <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
      {sessionArray.map((session) => (
        <div
          key={session.id}
          role="tab"
          tabIndex={0}
          className={cn(
            'group relative flex items-center gap-2 px-3 py-1.5 text-xs transition-all cursor-pointer min-w-0',
            'hover:bg-accent/50',
            activeSessionId === session.id
              ? 'bg-accent/30 text-foreground'
              : 'text-muted-foreground'
          )}
          onClick={() => setActiveSession(session.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActiveSession(session.id);
            }
          }}
        >
          <span className="truncate max-w-[200px]">{session.title}</span>
          <button
            type="button"
            className={cn(
              'h-4 w-4 flex items-center justify-center rounded transition-opacity',
              'hover:bg-destructive/20',
              'opacity-0 group-hover:opacity-100',
              activeSessionId === session.id && 'opacity-100'
            )}
            onClick={(e) => handleCloseTerminal(session.ptyId, e)}
          >
            <X className="h-3 w-3" />
          </button>
          {/* Active tab indicator */}
          {activeSessionId === session.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 ml-1 flex-shrink-0"
        onClick={handleNewTerminal}
        title="New terminal"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
