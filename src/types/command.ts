// src/types/command.ts

import type { z } from 'zod';

/**
 * Command execution context - provides access to current application state
 */
export interface CommandContext {
  /** Current task ID if available */
  taskId?: string;
  /** Current repository path */
  repositoryPath?: string;
  /** Currently selected file */
  selectedFile?: string;
  /** Current file content */
  fileContent?: string;
  /** Function to send a message to the AI */
  sendMessage?: (message: string) => Promise<void>;
  /** Function to create a new task */
  createNewTask?: () => Promise<void>;
}

/**
 * Command execution result
 */
export interface CommandResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Human-readable message about the execution */
  message?: string;
  /** Error message if execution failed */
  error?: string;
  /** Optional data returned by the command */
  data?: unknown;
  /** Whether the command should continue processing (e.g., send message to AI) */
  continueProcessing?: boolean;
  /** Message to send to AI if continueProcessing is true */
  aiMessage?: string;
}

/**
 * Command parameter definition using Zod schema
 */
export interface CommandParameter {
  /** Parameter name */
  name: string;
  /** Parameter description */
  description: string;
  /** Whether the parameter is required */
  required: boolean;
  /** Default value if not provided */
  defaultValue?: unknown;
  /** Parameter type hint for UI */
  type?: 'string' | 'number' | 'boolean' | 'file' | 'url';
}

/**
 * Command execution function signature
 */
export type CommandExecutor = (
  args: Record<string, unknown>,
  context: CommandContext
) => Promise<CommandResult> | CommandResult;

/**
 * Command category for organization
 */
export enum CommandCategory {
  GIT = 'git',
  TASK = 'task',
  PROJECT = 'project',
  AI = 'ai',
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

/**
 * Command type - how the command should be executed
 */
export enum CommandType {
  /** Execute immediately and potentially send message to AI */
  ACTION = 'action',
  /** Generate and send a prompt to AI */
  AI_PROMPT = 'ai_prompt',
  /** Execute a complex workflow */
  WORKFLOW = 'workflow',
  /** Just insert text into input */
  TEXT_INSERT = 'text_insert',
}

/**
 * Core command definition
 */
export interface Command {
  /** Unique command identifier */
  id: string;
  /** Command name (without the /) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Command category for grouping */
  category: CommandCategory;
  /** Command execution type */
  type: CommandType;
  /** Zod schema for parameter validation */
  parametersSchema?: z.ZodSchema;
  /** Human-readable parameter descriptions */
  parameters?: CommandParameter[];
  /** Command execution function */
  executor: CommandExecutor;
  /** Whether this is a built-in system command */
  isBuiltIn: boolean;
  /** Whether the command is enabled */
  enabled: boolean;
  /** Command aliases for quicker access */
  aliases?: string[];
  /** Icon name (Lucide icon) for UI display */
  icon?: string;
  /** Whether command requires a repository context */
  requiresRepository?: boolean;
  /** Whether command requires an active task */
  requiresTask?: boolean;
  /** Command usage examples */
  examples?: string[];
  /** Preferred agent ID to handle this command's AI message */
  preferredAgentId?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Parsed command input from user
 */
export interface ParsedCommand {
  /** The command object if found */
  command: Command | null;
  /** Raw command name entered by user */
  commandName: string;
  /** Parsed arguments */
  args: Record<string, unknown>;
  /** Raw argument string */
  rawArgs: string;
  /** Whether the command was found in registry */
  isValid: boolean;
  /** Validation errors if any */
  errors?: string[];
}

/**
 * Command suggestion for autocomplete
 */
export interface CommandSuggestion {
  /** The command object */
  command: Command;
  /** Relevance score for sorting */
  score: number;
  /** Which part matched the search */
  matchedBy: 'name' | 'alias' | 'description';
  /** Highlighted text for display */
  highlightedName?: string;
}

/**
 * Command picker state
 */
export interface CommandPickerState {
  /** Whether the picker is visible */
  isVisible: boolean;
  /** Current search query */
  query: string;
  /** Filtered command suggestions */
  suggestions: CommandSuggestion[];
  /** Currently selected suggestion index */
  selectedIndex: number;
  /** Picker position on screen */
  position: { top: number; left: number };
}

/**
 * Data for creating a new custom command
 */
export interface CreateCommandData {
  name: string;
  description: string;
  category: CommandCategory;
  type: CommandType;
  parametersSchema?: string; // JSON string of Zod schema
  parameters?: CommandParameter[];
  executor: string; // Serialized function or predefined action
  enabled?: boolean;
  aliases?: string[];
  icon?: string;
  requiresRepository?: boolean;
  requiresTask?: boolean;
  examples?: string[];
}

/**
 * Data for updating an existing command
 */
export interface UpdateCommandData extends Partial<CreateCommandData> {}

/**
 * Command registry configuration
 */
export interface CommandRegistryConfig {
  /** Whether to load built-in commands */
  loadBuiltInCommands: boolean;
  /** Whether to load user custom commands */
  loadCustomCommands: boolean;
  /** Maximum number of suggestions to show */
  maxSuggestions: number;
  /** Enable fuzzy search matching */
  enableFuzzySearch: boolean;
}

/**
 * Command event types for the event system
 */
export enum CommandEventType {
  COMMAND_EXECUTED = 'command_executed',
  COMMAND_FAILED = 'command_failed',
  COMMAND_REGISTERED = 'command_registered',
  COMMAND_UNREGISTERED = 'command_unregistered',
}

/**
 * Command event data
 */
export interface CommandEvent {
  type: CommandEventType;
  command: Command;
  context?: CommandContext;
  result?: CommandResult;
  error?: Error;
  timestamp: Date;
}

/**
 * Command event listener function
 */
export type CommandEventListener = (event: CommandEvent) => void;
