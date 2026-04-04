import type {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';
import { platform } from '@tauri-apps/plugin-os';
import { type Child, Command } from '@tauri-apps/plugin-shell';
import { logger } from '@/lib/logger';
import type { MCPServer } from '@/types';

/**
 * Shell wrapper configuration for each platform
 */
interface ShellWrapperConfig {
  name: string;
  args: string[];
}

/**
 * Get the appropriate login shell wrapper based on platform
 * This ensures user's shell configuration files are loaded (nvm, pyenv, etc.)
 * Returns both the shell name and the required args prefix
 *
 * Note: We use -l (login shell) but NOT -i (interactive) because:
 * - Interactive shells expect a TTY and can cause issues with stdin/stdout
 * - Login shell is sufficient to load ~/.zprofile, ~/.zshrc, ~/.bashrc etc.
 */
export async function getLoginShellWrapper(): Promise<ShellWrapperConfig> {
  const os = await platform();

  if (os === 'windows') {
    return {
      name: 'login-shell-cmd',
      args: ['/C'],
    };
  }

  // For macOS, prefer zsh (default shell since Catalina)
  if (os === 'macos') {
    return {
      name: 'login-shell-zsh',
      args: ['-l', '-c'],
    };
  }

  // For Linux, prefer bash
  return {
    name: 'login-shell-bash',
    args: ['-l', '-c'],
  };
}

/**
 * Build a command string from command and args, properly escaping arguments
 */
export function buildCommandString(command: string, args?: string[]): string {
  if (!args?.length) {
    return command;
  }

  // Properly escape arguments
  const escapedArgs = args.map((arg) => {
    // If arg contains spaces, quotes, or shell special characters, wrap in quotes
    if (arg.includes(' ') || arg.includes('"') || arg.includes("'") || arg.includes('$')) {
      // Escape double quotes and wrap in double quotes
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  });

  return `${command} ${escapedArgs.join(' ')}`;
}

/**
 * Tauri-based persistent MCP transport using exec-sh
 * Uses a different approach: start server once and communicate via file pipes or multiple connections
 */
export class TauriPersistentTransport implements Transport {
  private server: MCPServer;
  private command: Command<string> | null = null;
  private child: Child | null = null;
  private isConnected = false;
  private messageHandlers: ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private messageBuffer = '';
  private initializationPromise: Promise<void> | null = null;

  // Transport interface properties
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
  public sessionId?: string;
  public setProtocolVersion?: (version: string) => void;

  constructor(server: MCPServer) {
    this.server = server;
  }

  async start(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      logger.info(
        `Starting persistent MCP server: ${this.server.stdio_command} ${this.server.stdio_args?.join(' ') || ''}`
      );

      if (!this.server.stdio_command) {
        throw new Error('stdio_command is required for stdio transport');
      }

      // Build the full command string and wrap with login shell
      // This ensures user's shell configuration is loaded (nvm, pyenv, etc.)
      const fullCommand = buildCommandString(
        this.server.stdio_command,
        this.server.stdio_args || []
      );
      const shellWrapper = await getLoginShellWrapper();

      logger.info(
        `Using shell wrapper: ${shellWrapper.name} with args: [${shellWrapper.args.join(', ')}, "${fullCommand}"]`
      );

      // Build spawn options with environment variables if provided
      const hasEnvVars = this.server.stdio_env && Object.keys(this.server.stdio_env).length > 0;
      const spawnOptions = hasEnvVars ? { env: this.server.stdio_env } : undefined;

      if (hasEnvVars) {
        logger.info(
          `Setting environment variables for ${this.server.id}: ${Object.keys(this.server.stdio_env!).join(', ')}`
        );
      }

      // Tauri shell plugin requires passing all args including the fixed ones from config
      this.command = Command.create(
        shellWrapper.name,
        [...shellWrapper.args, fullCommand],
        spawnOptions
      );

      // Set up stdout handler for JSON-RPC messages
      this.command.stdout.on('data', (data: string) => {
        this.handleStdoutData(data);
      });

      // Set up stderr handler for warnings and errors
      this.command.stderr.on('data', (data: string) => {
        this.handleStderrData(data);
      });

      // Set up command event handlers
      this.command.on('close', (exitData: any) => {
        logger.info(`MCP server ${this.server.id} process closed with code: ${exitData.code}`);
        this.isConnected = false;
        this.notifyCloseHandlers();
      });

      this.command.on('error', (error: string) => {
        logger.error(`MCP server ${this.server.id} process error:`, error);
        this.notifyErrorHandlers(new Error(error));
      });

      // Spawn the persistent process
      this.child = await this.command.spawn();

      logger.info(`MCP server process spawned for ${this.server.id}, PID: ${this.child.pid}`);

      this.isConnected = true;
      logger.info(`Persistent MCP server transport started for ${this.server.id}`);
    } catch (error) {
      logger.error(`Failed to start persistent MCP server transport for ${this.server.id}:`, error);
      this.initializationPromise = null;
      throw error;
    }
  }

  private handleStdoutData(data: string): void {
    // Add data to buffer
    this.messageBuffer += data;

    // Try to parse complete JSON-RPC messages
    const lines = this.messageBuffer.split('\n');

    // Keep the last (potentially incomplete) line in buffer
    this.messageBuffer = lines.pop() || '';

    // Process complete lines
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Skip non-JSON lines (warnings, logs, etc.)
      if (!trimmedLine.startsWith('{')) {
        logger.debug(`Skipping non-JSON stdout line from ${this.server.id}:`, trimmedLine);
        continue;
      }

      try {
        const message = JSON.parse(trimmedLine) as JSONRPCMessage;
        logger.debug(`Received JSON-RPC message from ${this.server.id}:`, message);
        this.notifyMessageHandlers(message);
      } catch (parseError) {
        logger.warn(
          `Failed to parse JSON-RPC message from ${this.server.id}:`,
          trimmedLine,
          parseError
        );
      }
    }
  }

  private handleStderrData(data: string): void {
    const message = data.trim();
    if (!message) return;

    // Handle known Chrome DevTools MCP warnings
    if (
      message.includes('chrome-devtools-mcp exposes content') ||
      message.includes('Avoid sharing sensitive') ||
      message.includes('debug, and modify any data')
    ) {
      logger.info(`Chrome DevTools MCP warning: ${message}`);
      return;
    }

    // Log other stderr messages as warnings
    logger.warn(`MCP server ${this.server.id} stderr:`, message);
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    if (!this.isConnected || !this.child) {
      throw new Error(`Transport not connected for server ${this.server.id}`);
    }

    try {
      const messageStr = JSON.stringify(message);
      logger.debug(`Sending JSON-RPC message to ${this.server.id}:`, message);

      // Write to stdin with newline (as per JSON-RPC over stdio)
      await this.child.write(`${messageStr}\n`);
    } catch (error) {
      logger.error(`Failed to send message to MCP server ${this.server.id}:`, error);
      this.notifyErrorHandlers(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      logger.info(`Closing persistent MCP server transport for ${this.server.id}`);

      if (this.child) {
        // Try graceful shutdown first
        try {
          await this.child.write('{"jsonrpc":"2.0","method":"shutdown","id":"shutdown"}\n');

          // Wait a bit for graceful shutdown
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (shutdownError) {
          logger.warn(`Graceful shutdown failed for ${this.server.id}:`, shutdownError);
        }

        // Force kill if still running
        try {
          await this.child.kill();
        } catch (killError) {
          logger.warn(`Force kill failed for ${this.server.id}:`, killError);
        }

        this.child = null;
      }

      // Clean up command reference
      this.command = null;

      this.isConnected = false;
      this.messageBuffer = '';
      this.initializationPromise = null;

      this.notifyCloseHandlers();

      logger.info(`Persistent MCP server transport closed for ${this.server.id}`);
    } catch (error) {
      logger.error(`Failed to close persistent MCP server transport for ${this.server.id}:`, error);
      throw error;
    }
  }

  // Event handler management
  onMessage(callback: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void): void {
    this.messageHandlers.push(callback);
    this.onmessage = callback;
  }

  onClose(callback: () => void): void {
    this.closeHandlers.push(callback);
    this.onclose = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorHandlers.push(callback);
    this.onerror = callback;
  }

  // Notification helpers
  private notifyMessageHandlers(message: JSONRPCMessage, extra?: MessageExtraInfo): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message, extra);
      } catch (error) {
        logger.warn(`Message handler error for ${this.server.id}:`, error);
      }
    }

    if (this.onmessage) {
      try {
        this.onmessage(message, extra);
      } catch (error) {
        logger.warn(`onmessage handler error for ${this.server.id}:`, error);
      }
    }
  }

  private notifyCloseHandlers(): void {
    for (const handler of this.closeHandlers) {
      try {
        handler();
      } catch (error) {
        logger.warn(`Close handler error for ${this.server.id}:`, error);
      }
    }

    if (this.onclose) {
      try {
        this.onclose();
      } catch (error) {
        logger.warn(`onclose handler error for ${this.server.id}:`, error);
      }
    }
  }

  private notifyErrorHandlers(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (handlerError) {
        logger.warn(`Error handler error for ${this.server.id}:`, handlerError);
      }
    }

    if (this.onerror) {
      try {
        this.onerror(error);
      } catch (handlerError) {
        logger.warn(`onerror handler error for ${this.server.id}:`, handlerError);
      }
    }
  }

  // Stream interfaces for compatibility with experimental_createMCPClient
  private _readableStream?: ReadableStream<JSONRPCMessage>;
  private _writableStream?: WritableStream<JSONRPCMessage>;

  get readable(): ReadableStream<JSONRPCMessage> {
    if (!this._readableStream) {
      this._readableStream = new ReadableStream({
        start: (controller) => {
          this.onMessage((message) => {
            try {
              controller.enqueue(message);
            } catch (e) {
              logger.warn(`Failed to enqueue message for ${this.server.id}:`, e);
            }
          });

          this.onClose(() => {
            try {
              controller.close();
            } catch (e) {
              logger.warn(`Failed to close readable stream for ${this.server.id}:`, e);
            }
          });

          this.onError((error) => {
            try {
              controller.error(error);
            } catch (e) {
              logger.warn(`Failed to error readable stream for ${this.server.id}:`, e);
            }
          });
        },
      });
    }
    return this._readableStream;
  }

  get writable(): WritableStream<JSONRPCMessage> {
    if (!this._writableStream) {
      this._writableStream = new WritableStream({
        write: async (chunk: JSONRPCMessage) => {
          try {
            await this.send(chunk);
          } catch (error) {
            logger.error(`Failed to write to persistent transport for ${this.server.id}:`, error);
            throw error;
          }
        },
        close: async () => {
          try {
            await this.close();
          } catch (error) {
            logger.error(`Failed to close persistent transport for ${this.server.id}:`, error);
            throw error;
          }
        },
      });
    }
    return this._writableStream;
  }

  // Utility methods
  isReady(): boolean {
    return this.isConnected && this.child !== null;
  }

  getServerId(): string {
    return this.server.id;
  }

  getServerName(): string {
    return this.server.name;
  }

  getProcessId(): number | undefined {
    return this.child?.pid;
  }
}
