import {
  AlertCircle,
  CheckCircle2,
  Power,
  PowerOff,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMultiMCPTools } from '@/hooks/use-multi-mcp-tools';
import { logger } from '@/lib/logger';

interface MCPToolsSelectorProps {
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
}

export function MCPToolsSelector({ selectedTools, onToolsChange }: MCPToolsSelectorProps) {
  const {
    servers,
    allTools,
    isLoading,
    error,
    isHealthy,
    refreshTools,
    enableServer,
    disableServer,
  } = useMultiMCPTools();

  const handleToolToggle = (toolPrefixedName: string, checked: boolean) => {
    const newSelectedTools = new Set(selectedTools);
    if (checked) {
      newSelectedTools.add(toolPrefixedName);
    } else {
      newSelectedTools.delete(toolPrefixedName);
    }
    onToolsChange(Array.from(newSelectedTools));
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    if (error) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (isHealthy) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (isLoading) return 'Loading MCP servers...';
    if (error) return `Error: ${error}`;
    if (!isHealthy) return 'No MCP servers connected';
    const enabledCount = servers.filter((s) => s.server.is_enabled).length;
    const connectedCount = servers.filter((s) => s.isConnected).length;
    return `${enabledCount} servers enabled, ${connectedCount} connected, ${allTools.length} tools available`;
  };

  const handleServerToggle = async (serverId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enableServer(serverId);
      } else {
        await disableServer(serverId);
      }
    } catch (error) {
      logger.error(`Failed to ${enabled ? 'enable' : 'disable'} server ${serverId}:`, error);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {getStatusIcon()}
            MCP Tools
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshTools}
            disabled={isLoading}
            className="h-6 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{getStatusText()}</p>
      </CardHeader>

      {servers.length > 0 && (
        <CardContent className="pt-0 space-y-4">
          {servers.map((serverData) => (
            <div key={serverData.server.id} className="space-y-2">
              {/* Server Header */}
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  <span className="font-medium text-sm">{serverData.server.name}</span>

                  {/* Status Badges */}
                  <div className="flex gap-1">
                    {serverData.server.is_built_in && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        Built-in
                      </Badge>
                    )}

                    {serverData.isConnected ? (
                      <Badge
                        variant="default"
                        className="text-xs px-1 py-0 bg-green-100 text-green-800"
                      >
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs px-1 py-0">
                        {serverData.error ? 'Error' : 'Disconnected'}
                      </Badge>
                    )}

                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {serverData.tools.length} tools
                    </Badge>
                  </div>
                </div>

                {/* Server Toggle */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    handleServerToggle(serverData.server.id, !serverData.server.is_enabled)
                  }
                  disabled={isLoading || serverData.server.is_built_in}
                  className="h-6 w-6 p-0"
                  title={serverData.server.is_enabled ? 'Disable server' : 'Enable server'}
                >
                  {serverData.server.is_enabled ? (
                    <Power className="h-3 w-3 text-green-600" />
                  ) : (
                    <PowerOff className="h-3 w-3 text-gray-400" />
                  )}
                </Button>
              </div>

              {/* Error Message */}
              {serverData.error && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded ml-4">
                  {serverData.error}
                </div>
              )}

              {/* Tools List */}
              {serverData.server.is_enabled && serverData.tools.length > 0 && (
                <div className="ml-4 grid grid-cols-1 gap-1 md:grid-cols-2">
                  {serverData.tools.map((tool) => (
                    <label
                      key={tool.prefixedName}
                      className={`flex items-start gap-2 text-xs p-2 rounded border ${
                        tool.isAvailable && serverData.isConnected
                          ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTools.includes(tool.prefixedName)}
                        onChange={(e) => handleToolToggle(tool.prefixedName, e.target.checked)}
                        disabled={!tool.isAvailable || !serverData.isConnected}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {tool.name}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 truncate">
                          {tool.description}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          ID: {tool.prefixedName}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* No Tools Message */}
              {serverData.server.is_enabled &&
                serverData.tools.length === 0 &&
                serverData.isConnected && (
                  <div className="text-xs text-gray-500 italic ml-4 p-2">
                    No tools available from this server
                  </div>
                )}
            </div>
          ))}
        </CardContent>
      )}

      {error && (
        <CardContent className="pt-0">
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {error}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
