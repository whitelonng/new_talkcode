// src/hooks/use-multi-mcp-tools.ts
import { useEffect, useMemo } from 'react';
import { type MCPServerWithTools, useMCPStore } from '@/stores/mcp-store';

// Re-export type for backward compatibility
export type { MCPServerWithTools };

/**
 * Hook for managing MCP tools
 * Now uses global store to prevent duplicate loading
 */
export function useMultiMCPTools() {
  const {
    servers,
    isLoading,
    error,
    isHealthy,
    loadMCPData,
    refreshTools,
    refreshServer,
    enableServer,
    disableServer,
    reloadData,
  } = useMCPStore();

  useEffect(() => {
    loadMCPData();
  }, [loadMCPData]);

  // Get all tools across all servers
  const allTools = useMemo(() => servers.flatMap((serverData) => serverData.tools), [servers]);

  // Get enabled servers
  const enabledServers = useMemo(
    () => servers.filter((serverData) => serverData.server.is_enabled),
    [servers]
  );

  // Get connected servers
  const connectedServers = useMemo(
    () => servers.filter((serverData) => serverData.isConnected),
    [servers]
  );

  return {
    servers,
    allTools,
    enabledServers,
    connectedServers,
    isLoading,
    error,
    isHealthy,
    refreshTools,
    refreshServer,
    enableServer,
    disableServer,
    reloadData,
  };
}
