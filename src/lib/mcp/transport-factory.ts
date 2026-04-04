// src/lib/mcp/transport-factory.ts

import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { logger } from '@/lib/logger';
import { streamFetch } from '@/lib/tauri-fetch';
import type { MCPServer } from '@/types';
import { TauriPersistentTransport } from './tauri-persistent-transport';

export type MCPTransport =
  | StreamableHTTPClientTransport
  | SSEClientTransport
  | TauriPersistentTransport;

/**
 * Factory for creating MCP transport instances based on server configuration
 */
export class TransportFactory {
  private constructor() {}

  /**
   * Create a transport instance for the given MCP server
   */
  static createTransport(server: MCPServer): MCPTransport {
    try {
      switch (server.protocol) {
        case 'http':
          return TransportFactory.createHTTPTransport(server);

        case 'sse':
          return TransportFactory.createSSETransport(server);

        case 'stdio':
          return TransportFactory.createStdioTransport(server);

        default:
          throw new Error(`Unsupported protocol: ${server.protocol}`);
      }
    } catch (error) {
      logger.error(`Failed to create transport for server ${server.id}:`, error);
      throw new Error(`Failed to create transport for server ${server.id}: ${error}`);
    }
  }

  /**
   * Create StreamableHTTP transport for HTTP-based MCP servers
   */
  private static createHTTPTransport(server: MCPServer): StreamableHTTPClientTransport {
    try {
      let url = new URL(server.url);

      // In dev, proxy GitHub MCP through Vite to avoid CORS
      // This keeps requests same-origin (http://localhost:1420)
      if (server.id === 'github') {
        try {
          // Better dev environment detection
          const isDev =
            typeof window !== 'undefined' &&
            (window.location.origin.includes('localhost:1420') ||
              window.location.origin.includes('127.0.0.1:1420'));
          if (isDev) {
            url = new URL('/mcp/github/', window.location.origin);
            logger.info(`Using dev proxy URL for ${server.id}: ${url.toString()}`);
          }
        } catch (error) {
          logger.warn('Dev environment detection failed:', error);
          // ignore env detection errors; fall back to direct URL
        }
      }

      // Prepare headers
      // Note: Do NOT set forbidden browser headers like 'User-Agent' in WebView/Tauri
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...server.headers,
      };

      // Add API key to headers if provided
      if (server.api_key) {
        headers.Authorization = `Bearer ${server.api_key}`;
        logger.info(
          `Adding Authorization header for server ${server.id} with token: ${server.api_key.substring(0, 8)}...`
        );
      } else {
        logger.warn(
          `No API key found for server ${server.id} - this may cause authentication failures`
        );
      }

      // Do not add non-standard custom headers for GitHub; they can break CORS preflight

      // Create transport with proper headers support
      // For GitHub MCP server, we need to ensure proper parameter structure
      // Use streamFetch (Tauri backend proxy) to bypass browser CORS and header restrictions
      // streamFetch supports SSE streaming which is required for MCP's server-to-client messages
      const transport = new StreamableHTTPClientTransport(url, {
        fetch: streamFetch as typeof fetch,
        requestInit: {
          // Some browsers will silently drop forbidden headers; ensure we only send safe ones
          headers,
          // mode: 'cors' is the default; keep explicit for clarity in WebView
          mode: 'cors',
        },
      });

      logger.info(`Created HTTP transport for ${server.id} at ${server.url}`);

      return transport;
    } catch (error) {
      logger.error(`Failed to create HTTP transport for ${server.id}:`, error);
      // Provide a clearer hint for common WebView failures
      const message = error instanceof Error ? error.message : String(error);
      if (/user-agent/i.test(message) || /forbidden header/i.test(message)) {
        logger.warn(
          'HTTP transport error suggests a forbidden header; ensure no restricted headers are set.'
        );
      }
      throw error;
    }
  }

  /**
   * Create SSE transport for Server-Sent Events MCP servers
   */
  private static createSSETransport(server: MCPServer): SSEClientTransport {
    try {
      let url = new URL(server.url);

      if (server.id === 'github') {
        try {
          // Better dev environment detection
          const isDev =
            typeof window !== 'undefined' &&
            (window.location.origin.includes('localhost:1420') ||
              window.location.origin.includes('127.0.0.1:1420'));
          if (isDev) {
            url = new URL('/mcp/github/', window.location.origin);
            logger.info(`Using dev proxy URL for ${server.id} (SSE): ${url.toString()}`);
          }
        } catch (error) {
          logger.warn('Dev environment detection failed (SSE):', error);
          // ignore
        }
      }

      // SSEClientTransport constructor options
      const options: any = {};

      // Add API key to headers if provided
      if (server.api_key || server.headers) {
        options.headers = {
          ...server.headers,
        };

        if (server.api_key) {
          options.headers.Authorization = `Bearer ${server.api_key}`;
        }
      }

      const transport = new SSEClientTransport(url, options);

      logger.info(`Created SSE transport for ${server.id} at ${server.url}`);

      return transport;
    } catch (error) {
      logger.error(`Failed to create SSE transport for ${server.id}:`, error);
      throw error;
    }
  }

  /**
   * Create stdio transport for local MCP servers
   * Uses persistent transport for better MCP protocol support
   */
  private static createStdioTransport(server: MCPServer): TauriPersistentTransport {
    try {
      if (!server.stdio_command) {
        throw new Error('stdio_command is required for stdio protocol');
      }

      const transport = new TauriPersistentTransport(server);
      logger.info(
        `Created Persistent transport for ${server.id} using command: ${server.stdio_command}`
      );
      return transport;
    } catch (error) {
      logger.error(`Failed to create Stdio transport for ${server.id}:`, error);
      throw error;
    }
  }

  /**
   * Validate server configuration for transport creation
   */
  static validateServerConfig(server: MCPServer): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Common validations
    if (!server.id) {
      errors.push('Server ID is required');
    }
    if (!server.name) {
      errors.push('Server name is required');
    }
    if (!server.protocol) {
      errors.push('Protocol is required');
    }

    // Protocol-specific validations
    switch (server.protocol) {
      case 'http':
      case 'sse':
        if (!server.url) {
          errors.push('URL is required for HTTP/SSE protocols');
        } else {
          try {
            new URL(server.url);
          } catch {
            errors.push('Invalid URL format');
          }
        }
        break;

      case 'stdio':
        if (!server.stdio_command) {
          errors.push('stdio_command is required for stdio protocol');
        }
        break;

      default:
        errors.push(`Unsupported protocol: ${server.protocol}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get protocol-specific configuration schema
   */
  static getProtocolSchema(protocol: string): any {
    switch (protocol) {
      case 'http':
        return {
          required: ['url'],
          optional: ['api_key', 'headers'],
          description: 'HTTP-based MCP server with StreamableHTTP transport',
        };

      case 'sse':
        return {
          required: ['url'],
          optional: ['api_key', 'headers'],
          description: 'Server-Sent Events MCP server',
        };

      case 'stdio':
        return {
          required: ['stdio_command'],
          optional: ['stdio_args'],
          description: 'Local MCP server via stdio communication using Tauri Command',
        };

      default:
        return {
          required: [],
          optional: [],
          description: 'Unknown protocol',
        };
    }
  }

  /**
   * Get list of supported protocols
   */
  static getSupportedProtocols(): Array<{
    value: string;
    label: string;
    description: string;
  }> {
    return [
      {
        value: 'http',
        label: 'HTTP',
        description: 'StreamableHTTP transport for web-based MCP servers',
      },
      {
        value: 'sse',
        label: 'Server-Sent Events',
        description: 'SSE transport for real-time MCP servers',
      },
      {
        value: 'stdio',
        label: 'Standard I/O',
        description: 'Local MCP servers via command-line interface using Tauri Command',
      },
    ];
  }
}
