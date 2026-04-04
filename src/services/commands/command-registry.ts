// src/services/commands/command-registry.ts

import { logger } from '@/lib/logger';
import type {
  Command,
  CommandEvent,
  CommandEventListener,
  CommandRegistryConfig,
  CommandSuggestion,
  UpdateCommandData,
} from '@/types/command';
import { CommandCategory, CommandEventType } from '@/types/command';

/**
 * Command Registry - manages all available commands in the application
 * Provides registration, search, filtering, and event management for commands
 */
class CommandRegistry {
  private commands = new Map<string, Command>();
  private eventListeners = new Map<CommandEventType, Set<CommandEventListener>>();
  private config: CommandRegistryConfig = {
    loadBuiltInCommands: true,
    loadCustomCommands: true,
    maxSuggestions: 10,
    enableFuzzySearch: true,
  };
  private loaded = false;

  constructor() {
    // Initialize event listener sets
    for (const eventType of Object.values(CommandEventType)) {
      this.eventListeners.set(eventType, new Set());
    }
  }

  /**
   * Initialize the registry and load commands
   */
  async initialize(config?: Partial<CommandRegistryConfig>): Promise<void> {
    if (this.loaded) {
      logger.info('CommandRegistry: Already initialized, skipping');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    logger.info('CommandRegistry: Initializing...');

    try {
      // Load built-in commands first
      if (this.config.loadBuiltInCommands) {
        await this.loadBuiltInCommands();
      }

      // Load custom commands from database
      if (this.config.loadCustomCommands) {
        await this.loadCustomCommands();
      }

      this.loaded = true;
      logger.info(`CommandRegistry: Loaded ${this.commands.size} commands`);
    } catch (error) {
      logger.error('Failed to initialize command registry:', error);
      throw error;
    }
  }

  /**
   * Register a new command
   */
  async register(command: Command): Promise<void> {
    // Validate command
    this.validateCommand(command);

    // Store in memory
    this.commands.set(command.id, command);

    // Emit event
    this.emitEvent(CommandEventType.COMMAND_REGISTERED, command);

    logger.info(`CommandRegistry: Registered command '${command.name}'`);
  }

  /**
   * Update an existing command
   */
  async update(commandId: string, updates: UpdateCommandData): Promise<void> {
    const existing = this.commands.get(commandId);
    if (!existing) {
      throw new Error(`Command with ID '${commandId}' not found`);
    }

    const updated: Command = {
      ...existing,
      ...updates,
      id: commandId, // Prevent ID changes
      updatedAt: new Date(),
    } as Command;

    this.validateCommand(updated);
    this.commands.set(commandId, updated);

    logger.info(`CommandRegistry: Updated command '${updated.name}'`);
  }

  /**
   * Unregister a command
   */
  async unregister(commandId: string): Promise<void> {
    const command = this.commands.get(commandId);
    if (!command) {
      logger.error(`Command '${commandId}' not found for unregistration`);
      return;
    }

    this.commands.delete(commandId);
    this.emitEvent(CommandEventType.COMMAND_UNREGISTERED, command);

    logger.info(`CommandRegistry: Unregistered command '${command.name}'`);
  }

  /**
   * Get a command by ID
   */
  get(commandId: string): Command | undefined {
    return this.commands.get(commandId);
  }

  /**
   * Get a command by name or alias
   */
  getByName(name: string): Command | undefined {
    // First try exact name match
    for (const command of this.commands.values()) {
      if (command.name === name) {
        return command;
      }
    }

    // Then try alias match
    for (const command of this.commands.values()) {
      if (command.aliases?.includes(name)) {
        return command;
      }
    }

    return;
  }

  /**
   * List all commands
   */
  list(filters?: { category?: CommandCategory; enabled?: boolean; builtIn?: boolean }): Command[] {
    let commands = Array.from(this.commands.values());

    if (filters?.category) {
      commands = commands.filter((cmd) => cmd.category === filters.category);
    }

    if (filters?.enabled !== undefined) {
      commands = commands.filter((cmd) => cmd.enabled === filters.enabled);
    }

    if (filters?.builtIn !== undefined) {
      commands = commands.filter((cmd) => cmd.isBuiltIn === filters.builtIn);
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
  }

  search(query: string, limit?: number): CommandSuggestion[] {
    if (!query.trim()) {
      // Return all enabled commands when no query
      return this.list({ enabled: true })
        .slice(0, limit || this.config.maxSuggestions)
        .map((command) => ({
          command,
          score: 1.0,
          matchedBy: 'name' as const,
        }));
    }

    const suggestions: CommandSuggestion[] = [];
    const queryLower = query.toLowerCase();

    for (const command of this.commands.values()) {
      if (!command.enabled) continue;

      let score = 0;
      let matchedBy: 'name' | 'alias' | 'description' = 'name';

      // Exact name match (highest priority)
      if (command.name.toLowerCase() === queryLower) {
        score = 1.0;
        matchedBy = 'name';
      }
      // Name starts with query
      else if (command.name.toLowerCase().startsWith(queryLower)) {
        score = 0.9;
        matchedBy = 'name';
      }
      // Name contains query
      else if (command.name.toLowerCase().includes(queryLower)) {
        score = 0.7;
        matchedBy = 'name';
      }
      // Alias match
      else if (command.aliases?.some((alias) => alias.toLowerCase().includes(queryLower))) {
        score = 0.6;
        matchedBy = 'alias';
      }
      // Description match
      else if (command.description.toLowerCase().includes(queryLower)) {
        score = 0.4;
        matchedBy = 'description';
      }
      // Fuzzy search (if enabled)
      else if (this.config.enableFuzzySearch) {
        const fuzzyScore = this.calculateFuzzyScore(queryLower, command.name.toLowerCase());
        if (fuzzyScore > 0.3) {
          score = fuzzyScore * 0.3;
          matchedBy = 'name';
        }
      }

      if (score > 0) {
        suggestions.push({
          command,
          score,
          matchedBy,
          highlightedName: this.highlightMatch(command.name, query, matchedBy === 'name'),
        });
      }
    }

    // Sort by score (descending) and limit results
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit || this.config.maxSuggestions);
  }

  /**
   * Add event listener
   */
  on(eventType: CommandEventType, listener: CommandEventListener): void {
    this.eventListeners.get(eventType)?.add(listener);
  }

  /**
   * Remove event listener
   */
  off(eventType: CommandEventType, listener: CommandEventListener): void {
    this.eventListeners.get(eventType)?.delete(listener);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    builtIn: number;
    custom: number;
    byCategory: Record<CommandCategory, number>;
  } {
    const commands = Array.from(this.commands.values());
    const stats = {
      total: commands.length,
      enabled: commands.filter((cmd) => cmd.enabled).length,
      builtIn: commands.filter((cmd) => cmd.isBuiltIn).length,
      custom: commands.filter((cmd) => !cmd.isBuiltIn).length,
      byCategory: {} as Record<CommandCategory, number>,
    };

    // Count by category
    for (const category of Object.values(CommandCategory)) {
      stats.byCategory[category] = commands.filter((cmd) => cmd.category === category).length;
    }

    return stats;
  }

  /**
   * Clear all commands (mainly for testing)
   */
  clear(): void {
    this.commands.clear();
    this.loaded = false;
  }

  /**
   * Load built-in commands
   */
  private async loadBuiltInCommands(): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { getBuiltInCommands } = await import('./built-in-commands');
      const builtInCommands = await getBuiltInCommands();

      for (const command of builtInCommands) {
        await this.register(command);
      }

      logger.info(`CommandRegistry: Loaded ${builtInCommands.length} built-in commands`);
    } catch (error) {
      logger.error('Failed to load built-in commands:', error);
      // Don't throw - allow registry to continue without built-in commands
    }
  }

  /**
   * Load custom commands from database
   */
  private async loadCustomCommands(): Promise<void> {
    try {
      // TODO: Implement database loading for custom commands
      // This will be implemented later when we add persistence
      logger.info('CommandRegistry: Custom commands loading not yet implemented');
    } catch (error) {
      logger.error('Failed to load custom commands:', error);
    }
  }

  /**
   * Validate a command object
   */
  private validateCommand(command: Command): void {
    if (!(command.id && command.name)) {
      throw new Error('Command must have id and name');
    }

    if (!command.executor || typeof command.executor !== 'function') {
      throw new Error('Command must have a valid executor function');
    }

    // Check for ID conflicts (except when updating)
    const existing = this.commands.get(command.id);
    if (existing && existing !== command) {
      throw new Error(`Command with ID '${command.id}' already exists`);
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(type: CommandEventType, command: Command, result?: any, error?: Error): void {
    const event: CommandEvent = {
      type,
      command,
      result,
      error,
      timestamp: new Date(),
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          logger.error('Error in command event listener:', error);
        }
      }
    }
  }

  /**
   * Calculate fuzzy search score using simple Levenshtein-based algorithm
   */
  private calculateFuzzyScore(query: string, target: string): number {
    if (query === target) return 1.0;
    if (query.length === 0) return 0.0;
    if (target.length === 0) return 0.0;

    // Simple fuzzy scoring - can be improved with more sophisticated algorithms
    let matches = 0;
    let queryIndex = 0;

    for (let i = 0; i < target.length && queryIndex < query.length; i++) {
      if (target[i] === query[queryIndex]) {
        matches++;
        queryIndex++;
      }
    }

    return matches / query.length;
  }

  /**
   * Highlight matching text in command name
   */
  private highlightMatch(text: string, query: string, isNameMatch: boolean): string {
    if (!(isNameMatch && query)) return text;

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(queryLower);

    if (index === -1) return text;

    return (
      text.substring(0, index) +
      `<mark>${text.substring(index, index + query.length)}</mark>` +
      text.substring(index + query.length)
    );
  }
}

// Export singleton instance
export const commandRegistry = new CommandRegistry();
