// src/types/mcp.ts
/**
 * MCP (Model Context Protocol) type definitions
 */

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  protocol: 'http' | 'sse' | 'stdio';
  api_key?: string;
  headers?: Record<string, string>;
  stdio_command?: string;
  stdio_args?: string[];
  stdio_env?: Record<string, string>;
  is_enabled: boolean;
  is_built_in: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateMCPServerData {
  id: string;
  name: string;
  url: string;
  protocol: 'http' | 'sse' | 'stdio';
  api_key?: string;
  headers?: Record<string, string>;
  stdio_command?: string;
  stdio_args?: string[];
  stdio_env?: Record<string, string>;
  is_enabled?: boolean;
  is_built_in?: boolean;
}

export interface UpdateMCPServerData {
  name?: string;
  url?: string;
  protocol?: 'http' | 'sse' | 'stdio';
  api_key?: string;
  headers?: Record<string, string>;
  stdio_command?: string;
  stdio_args?: string[];
  stdio_env?: Record<string, string>;
  is_enabled?: boolean;
}

/**
 * MCP Tool information (runtime)
 */
export interface MCPToolInfo {
  id: string;
  name: string;
  description: string;
  prefixedName: string; // Format: {server_id}__{tool_name}
  serverId: string;
  serverName: string;
  isAvailable: boolean;
}

/**
 * MCP Server with tools (for store)
 */
export interface MCPServerWithTools {
  server: MCPServer;
  tools: MCPToolInfo[];
  isConnected: boolean;
  error?: string;
  toolCount: number;
}
