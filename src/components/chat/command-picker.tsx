// src/components/chat/command-picker.tsx

import * as Icons from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { commandRegistry } from '@/services/commands/command-registry';
import type { Command, CommandSuggestion } from '@/types/command';

interface CommandPickerProps {
  onCommandSelect: (command: Command, rawArgs: string) => void;
  onClose: () => void;
  searchQuery: string;
  position: { top: number; left: number };
}

export function CommandPicker({
  onCommandSelect,
  onClose,
  searchQuery,
  position,
}: CommandPickerProps) {
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parseCommandQuery = useCallback((query: string) => {
    // Remove leading slash if present
    const cleanQuery = query.startsWith('/') ? query.slice(1) : query;

    // Split on first space to separate command name from arguments
    const spaceIndex = cleanQuery.indexOf(' ');
    if (spaceIndex === -1) {
      return { commandQuery: cleanQuery, argsQuery: '' };
    }

    return {
      commandQuery: cleanQuery.slice(0, spaceIndex),
      argsQuery: cleanQuery.slice(spaceIndex + 1),
    };
  }, []);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      // Parse command name and arguments from search query
      const { commandQuery } = parseCommandQuery(searchQuery);

      // Search for commands using the command name part
      const commandSuggestions = commandRegistry.search(commandQuery, 10);
      setSuggestions(commandSuggestions);
      setSelectedIndex(0);
    } catch (error) {
      logger.error('Failed to load command suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, parseCommandQuery]);

  const handleCommandSelect = useCallback(
    (command: Command) => {
      const { argsQuery } = parseCommandQuery(searchQuery);
      onCommandSelect(command, argsQuery);
      onClose();
    },
    [searchQuery, onCommandSelect, onClose, parseCommandQuery]
  );

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            handleCommandSelect(suggestions[selectedIndex].command);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onClose, handleCommandSelect]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getCommandIcon = (command: Command) => {
    if (!command.icon) {
      return <Icons.Terminal className="h-4 w-4 text-gray-500" />;
    }

    // Get icon component from lucide-react
    const IconComponent = (
      Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
    )[command.icon];
    if (IconComponent) {
      return <IconComponent className="h-4 w-4 text-gray-500" />;
    }

    // Fallback to terminal icon
    return <Icons.Terminal className="h-4 w-4 text-gray-500" />;
  };

  const getCategoryColor = (command: Command) => {
    const colorMap: Record<string, string> = {
      git: 'text-orange-600',
      conversation: 'text-blue-600',
      project: 'text-green-600',
      ai: 'text-purple-600',
      system: 'text-gray-600',
      custom: 'text-indigo-600',
    };
    return colorMap[command.category] || 'text-gray-600';
  };

  const formatCommandUsage = (command: Command) => {
    const params = command.parameters || [];
    if (params.length === 0) {
      return `/${command.name}`;
    }

    const paramStrings = params.map((param) => {
      if (param.required) {
        return `<${param.name}>`;
      }
      return `[${param.name}]`;
    });

    return `/${command.name} ${paramStrings.join(' ')}`;
  };

  const highlightMatch = (text: string, isHighlighted: boolean) => {
    if (!isHighlighted) return text;
    return text; // For now, we'll skip highlighting implementation
  };

  if (loading) {
    return (
      <div
        className="fixed z-50 w-96 max-w-md rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        ref={containerRef}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="p-3 text-center text-muted-foreground text-sm">Loading commands...</div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div
        className="fixed z-50 w-96 max-w-md rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        ref={containerRef}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="p-3 text-center text-muted-foreground text-sm">
          {searchQuery.trim() ? 'No commands found' : 'Start typing to see commands'}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50 flex w-96 max-w-md flex-col rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
      ref={containerRef}
      style={{
        top: position.top,
        left: position.left,
        maxHeight: 'min(320px, calc(100vh - 20px))',
      }}
    >
      <div className="border-b px-3 py-2 text-muted-foreground text-xs dark:border-gray-600">
        {suggestions.length} command{suggestions.length !== 1 ? 's' : ''} found
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {suggestions.map((suggestion, index) => (
          // biome-ignore lint/a11y/useSemanticElements: Complex flex layout requires div, has proper keyboard handling
          <div
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700',
              index === selectedIndex && 'bg-blue-50 dark:bg-blue-900/20'
            )}
            key={suggestion.command.id}
            onClick={() => handleCommandSelect(suggestion.command)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCommandSelect(suggestion.command);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex-shrink-0 pt-0.5">{getCommandIcon(suggestion.command)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-medium text-sm',
                    index === selectedIndex
                      ? 'text-blue-800 dark:text-blue-200'
                      : 'text-gray-900 dark:text-gray-100'
                  )}
                >
                  {highlightMatch(
                    formatCommandUsage(suggestion.command),
                    suggestion.matchedBy === 'name'
                  )}
                </span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-medium text-xs',
                    getCategoryColor(suggestion.command),
                    'bg-gray-100 dark:bg-gray-700'
                  )}
                >
                  {suggestion.command.category}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground text-xs">
                {suggestion.command.description}
              </div>
              {suggestion.command.aliases && suggestion.command.aliases.length > 0 && (
                <div className="mt-1 text-muted-foreground text-xs">
                  Aliases: {suggestion.command.aliases.map((alias) => `/${alias}`).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
