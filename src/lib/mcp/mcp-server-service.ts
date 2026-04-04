// src/lib/mcp/mcp-server-service.ts

import { logger } from '@/lib/logger';
import type { TursoClient } from '@/services/database/turso-client';
import type { CreateMCPServerData, MCPServer, UpdateMCPServerData } from '@/types';

export class MCPServerService {
  constructor(private db: TursoClient) {}

  async createMCPServer(data: CreateMCPServerData): Promise<string> {
    const now = Date.now();

    try {
      await this.db.execute(
        `INSERT INTO mcp_servers (
          id, name, url, protocol, api_key, headers, stdio_command, stdio_args, stdio_env,
          is_enabled, is_built_in, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          data.id,
          data.name,
          data.url,
          data.protocol,
          data.api_key || null,
          JSON.stringify(data.headers || {}),
          data.stdio_command || null,
          JSON.stringify(data.stdio_args || []),
          JSON.stringify(data.stdio_env || {}),
          data.is_enabled ?? true,
          data.is_built_in ?? false,
          now,
          now,
        ]
      );

      logger.info(`Created MCP server: ${data.id}`);
      return data.id;
    } catch (error) {
      logger.error('Failed to create MCP server:', error);
      throw new Error(`Failed to create MCP server: ${error}`);
    }
  }

  async getMCPServers(): Promise<MCPServer[]> {
    try {
      const rows = await this.db.select<any[]>(
        'SELECT * FROM mcp_servers ORDER BY is_built_in DESC, name ASC'
      );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        protocol: row.protocol as 'http' | 'sse' | 'stdio',
        api_key: row.api_key,
        headers: row.headers ? JSON.parse(row.headers) : {},
        stdio_command: row.stdio_command,
        stdio_args: row.stdio_args ? JSON.parse(row.stdio_args) : [],
        stdio_env: row.stdio_env ? JSON.parse(row.stdio_env) : {},
        is_enabled: Boolean(row.is_enabled),
        is_built_in: Boolean(row.is_built_in),
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get MCP servers:', error);
      throw new Error(`Failed to get MCP servers: ${error}`);
    }
  }

  async getEnabledMCPServers(): Promise<MCPServer[]> {
    try {
      const rows = await this.db.select<any[]>(
        'SELECT * FROM mcp_servers WHERE is_enabled = 1 ORDER BY is_built_in DESC, name ASC'
      );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        protocol: row.protocol as 'http' | 'sse' | 'stdio',
        api_key: row.api_key,
        headers: row.headers ? JSON.parse(row.headers) : {},
        stdio_command: row.stdio_command,
        stdio_args: row.stdio_args ? JSON.parse(row.stdio_args) : [],
        stdio_env: row.stdio_env ? JSON.parse(row.stdio_env) : {},
        is_enabled: Boolean(row.is_enabled),
        is_built_in: Boolean(row.is_built_in),
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get enabled MCP servers:', error);
      throw new Error(`Failed to get enabled MCP servers: ${error}`);
    }
  }

  async getMCPServer(id: string): Promise<MCPServer | null> {
    try {
      const rows = await this.db.select<any[]>('SELECT * FROM mcp_servers WHERE id = $1', [id]);

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        id: row.id,
        name: row.name,
        url: row.url,
        protocol: row.protocol as 'http' | 'sse' | 'stdio',
        api_key: row.api_key,
        headers: row.headers ? JSON.parse(row.headers) : {},
        stdio_command: row.stdio_command,
        stdio_args: row.stdio_args ? JSON.parse(row.stdio_args) : [],
        stdio_env: row.stdio_env ? JSON.parse(row.stdio_env) : {},
        is_enabled: Boolean(row.is_enabled),
        is_built_in: Boolean(row.is_built_in),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch (error) {
      logger.error(`Failed to get MCP server ${id}:`, error);
      throw new Error(`Failed to get MCP server ${id}: ${error}`);
    }
  }

  async updateMCPServer(id: string, data: UpdateMCPServerData): Promise<void> {
    const now = Date.now();

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.url !== undefined) {
      updateFields.push(`url = $${paramIndex++}`);
      values.push(data.url);
    }
    if (data.protocol !== undefined) {
      updateFields.push(`protocol = $${paramIndex++}`);
      values.push(data.protocol);
    }
    if (data.api_key !== undefined) {
      updateFields.push(`api_key = $${paramIndex++}`);
      values.push(data.api_key);
    }
    if (data.headers !== undefined) {
      updateFields.push(`headers = $${paramIndex++}`);
      values.push(JSON.stringify(data.headers));
    }
    if (data.stdio_command !== undefined) {
      updateFields.push(`stdio_command = $${paramIndex++}`);
      values.push(data.stdio_command);
    }
    if (data.stdio_args !== undefined) {
      updateFields.push(`stdio_args = $${paramIndex++}`);
      values.push(JSON.stringify(data.stdio_args));
    }
    if (data.stdio_env !== undefined) {
      updateFields.push(`stdio_env = $${paramIndex++}`);
      values.push(JSON.stringify(data.stdio_env));
    }
    if (data.is_enabled !== undefined) {
      updateFields.push(`is_enabled = $${paramIndex++}`);
      values.push(data.is_enabled);
    }

    if (updateFields.length === 0) {
      return; // Nothing to update
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    values.push(now);
    values.push(id); // WHERE id = $last

    try {
      await this.db.execute(
        `UPDATE mcp_servers SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      logger.info(`Updated MCP server: ${id}`);
    } catch (error) {
      logger.error(`Failed to update MCP server ${id}:`, error);
      throw new Error(`Failed to update MCP server ${id}: ${error}`);
    }
  }

  async deleteMCPServer(id: string): Promise<void> {
    try {
      // Check if it's a built-in server
      const server = await this.getMCPServer(id);
      if (server?.is_built_in) {
        throw new Error('Cannot delete built-in MCP server');
      }

      await this.db.execute('DELETE FROM mcp_servers WHERE id = $1', [id]);
      logger.info(`Deleted MCP server: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete MCP server ${id}:`, error);
      throw new Error(`Failed to delete MCP server ${id}: ${error}`);
    }
  }

  async enableMCPServer(id: string): Promise<void> {
    await this.updateMCPServer(id, { is_enabled: true });
  }

  async disableMCPServer(id: string): Promise<void> {
    await this.updateMCPServer(id, { is_enabled: false });
  }

  async serverExists(id: string): Promise<boolean> {
    try {
      const rows = await this.db.select<any[]>('SELECT 1 FROM mcp_servers WHERE id = $1', [id]);
      return rows.length > 0;
    } catch (error) {
      logger.error(`Failed to check if MCP server exists ${id}:`, error);
      return false;
    }
  }
}
