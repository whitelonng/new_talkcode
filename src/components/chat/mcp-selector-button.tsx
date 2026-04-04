// src/components/chat/mcp-selector-button.tsx

import { Check, ExternalLink, RotateCcw, Server } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { useMultiMCPTools } from '@/hooks/use-multi-mcp-tools';
import { useAppSettings } from '@/hooks/use-settings';
import { getDocLinks } from '@/lib/doc-links';
import { logger } from '@/lib/logger';
import { useAgentStore } from '@/stores/agent-store';
import { useToolOverrideStore } from '@/stores/tool-override-store';

export function McpSelectorButton() {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const { settings } = useAppSettings();
  const { servers, allTools } = useMultiMCPTools();

  // Subscribe to agents Map (triggers re-render when any agent updates)
  const agents = useAgentStore((state) => state.agents);

  // Get current agent using store
  const currentAgent = useMemo(() => {
    if (!settings.assistantId) return null;
    return agents.get(settings.assistantId) || null;
  }, [agents, settings.assistantId]);

  // Subscribe to tool overrides
  const toolOverrides = useToolOverrideStore((state) => state.overrides);

  // Get current agent's selected MCP tools with overrides applied, filtered by enabled/connected servers
  const selectedMcpToolIds = useMemo(() => {
    if (!currentAgent?.tools) return new Set<string>();

    // Start with base MCP tools from agent (tools with __ prefix)
    const baseMcpTools = Object.keys(currentAgent.tools).filter((key) => key.includes('__'));
    const mcpToolsSet = new Set(baseMcpTools);

    // Apply tool overrides if they exist
    const override = currentAgent.id ? toolOverrides.get(currentAgent.id) : undefined;
    if (override) {
      // Add overridden MCP tools
      for (const toolId of override.addedTools) {
        if (toolId.includes('__')) {
          mcpToolsSet.add(toolId);
        }
      }
      // Remove overridden MCP tools
      for (const toolId of override.removedTools) {
        if (toolId.includes('__')) {
          mcpToolsSet.delete(toolId);
        }
      }
    }

    // Create maps for O(1) lookup instead of O(n) find operations
    const toolMap = new Map(allTools.map((t) => [t.prefixedName, t]));
    const serverMap = new Map(servers.map((s) => [s.server.name, s]));

    // Filter out tools from disabled servers
    const filteredTools = new Set<string>();
    for (const toolId of mcpToolsSet) {
      // Find the tool using map lookup (O(1) instead of O(n))
      const tool = toolMap.get(toolId);
      if (!tool) continue;

      // Find the corresponding server using map lookup (O(1) instead of O(n))
      const serverData = serverMap.get(tool.serverName);

      // Only include tools from enabled servers (regardless of connection status)
      if (serverData && serverData.server.is_enabled) {
        filteredTools.add(toolId);
      }
    }

    return filteredTools;
  }, [currentAgent, toolOverrides, servers, allTools]);

  // Group tools by enabled server
  const serverGroups = useMemo(() => {
    // Only include enabled servers
    const enabledServers = servers.filter((serverData) => serverData.server.is_enabled);

    return enabledServers.map((serverData) => {
      const serverTools = allTools.filter((tool) => tool.serverName === serverData.server.name);
      const selectedCount = serverTools.filter((tool) =>
        selectedMcpToolIds.has(tool.prefixedName)
      ).length;

      return {
        server: serverData.server,
        tools: serverTools,
        isConnected: serverData.isConnected,
        error: serverData.error,
        selectedCount,
      };
    });
  }, [servers, allTools, selectedMcpToolIds]);

  const handleToggleTool = (toolPrefixedName: string) => {
    if (!currentAgent) {
      toast.error(t.MCPServers.selector.noActiveAgent);
      return;
    }

    try {
      const isSelected = selectedMcpToolIds.has(toolPrefixedName);

      // Use tool override store for temporary modifications
      if (isSelected) {
        useToolOverrideStore.getState().removeTool(currentAgent.id, toolPrefixedName);
        toast.success(t.MCPServers.selector.toolRemoved);
      } else {
        useToolOverrideStore.getState().addTool(currentAgent.id, toolPrefixedName);
        toast.success(t.MCPServers.selector.toolAdded);
      }
    } catch (error) {
      logger.error('Failed to toggle MCP tool:', error);
      toast.error(t.MCPServers.selector.updateFailed);
    }
  };

  const handleSelectAllServerTools = (serverName: string) => {
    if (!currentAgent) {
      toast.error(t.MCPServers.selector.noActiveAgent);
      return;
    }

    try {
      const serverTools = allTools.filter(
        (tool) => tool.serverName === serverName && tool.isAvailable
      );
      const unselectedTools = serverTools.filter(
        (tool) => !selectedMcpToolIds.has(tool.prefixedName)
      );

      if (unselectedTools.length === 0) {
        toast.info(t.MCPServers.selector.allToolsAlreadySelected);
        return;
      }

      // Add all unselected tools from this server
      for (const tool of unselectedTools) {
        useToolOverrideStore.getState().addTool(currentAgent.id, tool.prefixedName);
      }

      toast.success(
        t.MCPServers.selector.toolsSelected
          ? t.MCPServers.selector.toolsSelected(unselectedTools.length)
          : `Selected ${unselectedTools.length} tools from ${serverName}`
      );
    } catch (error) {
      logger.error('Failed to select all server tools:', error);
      toast.error(t.MCPServers.selector.updateFailed);
    }
  };

  const handleClearAllServerTools = (serverName: string) => {
    if (!currentAgent) {
      toast.error(t.MCPServers.selector.noActiveAgent);
      return;
    }

    try {
      const serverTools = allTools.filter(
        (tool) => tool.serverName === serverName && tool.isAvailable
      );
      const selectedTools = serverTools.filter((tool) => selectedMcpToolIds.has(tool.prefixedName));

      if (selectedTools.length === 0) {
        toast.info(t.MCPServers.selector.noToolsToClear);
        return;
      }

      // Remove all selected tools from this server
      for (const tool of selectedTools) {
        useToolOverrideStore.getState().removeTool(currentAgent.id, tool.prefixedName);
      }

      toast.success(
        t.MCPServers.selector.toolsCleared
          ? t.MCPServers.selector.toolsCleared(selectedTools.length)
          : `Cleared ${selectedTools.length} tools from ${serverName}`
      );
    } catch (error) {
      logger.error('Failed to clear all server tools:', error);
      toast.error(t.MCPServers.selector.updateFailed);
    }
  };

  const handleReset = () => {
    if (!currentAgent) return;

    try {
      useToolOverrideStore.getState().clearOverride(currentAgent.id);
      toast.success(t.MCPServers.selector.overridesReset);
    } catch (error) {
      logger.error('Failed to reset MCP tool overrides:', error);
      toast.error(t.MCPServers.selector.resetFailed);
    }
  };

  const totalSelectedCount = selectedMcpToolIds.size;
  const hasOverride = currentAgent
    ? useToolOverrideStore.getState().hasOverride(currentAgent.id)
    : false;

  return (
    <HoverCard>
      <Popover open={open} onOpenChange={setOpen}>
        <HoverCardTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 relative"
              disabled={!currentAgent}
            >
              <Server className="h-4 w-4" />
              {totalSelectedCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 h-4 w-4 rounded-full text-[10px] flex items-center justify-center ${
                    hasOverride ? 'bg-orange-500 text-white' : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {totalSelectedCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-72">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{t.MCPServers.selector.title}</h4>
            <p className="text-xs text-muted-foreground">{t.MCPServers.selector.description}</p>
            <a
              href={getDocLinks().features.mcpServers}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {t.MCPServers.selector.learnMore}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </HoverCardContent>

        <PopoverContent className="w-96 p-0" align="start">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-sm">{t.MCPServers.selector.toolsTitle}</div>
              {hasOverride && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  {t.MCPServers.selector.modified}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {totalSelectedCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {totalSelectedCount} {t.MCPServers.selector.selected}
                </span>
              )}
              {hasOverride && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {t.MCPServers.selector.reset}
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            {serverGroups.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t.MCPServers.selector.noServersAvailable}
              </div>
            ) : (
              <div className="p-2 space-y-3">
                {serverGroups.map((group) => (
                  <div key={group.server.id} className="space-y-1">
                    {/* Server Header */}
                    <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded">
                      {/* Server selection checkbox */}
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-accent ${
                          group.selectedCount === group.tools.length
                            ? 'bg-primary border-primary'
                            : 'border-input'
                        }`}
                        onClick={() => {
                          if (group.selectedCount === group.tools.length) {
                            handleClearAllServerTools(group.server.name);
                          } else {
                            handleSelectAllServerTools(group.server.name);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (group.selectedCount === group.tools.length) {
                              handleClearAllServerTools(group.server.name);
                            } else {
                              handleSelectAllServerTools(group.server.name);
                            }
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {group.selectedCount === group.tools.length && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                        {group.selectedCount > 0 && group.selectedCount < group.tools.length && (
                          <div className="h-2 w-2 bg-primary rounded-full" />
                        )}
                      </div>

                      <Server className="h-3 w-3" />
                      <span className="font-medium text-sm flex-1">{group.server.name}</span>
                      {group.isConnected ? (
                        <Badge
                          variant="default"
                          className="text-xs px-1.5 py-0 bg-green-100 text-green-800"
                        >
                          {t.MCPServers.selector.connected}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          {group.error ? t.MCPServers.selector.error : t.MCPServers.disconnected}
                        </Badge>
                      )}
                      {group.selectedCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {group.selectedCount}/{group.tools.length}
                        </span>
                      )}
                    </div>

                    {/* Error Message */}
                    {group.error && (
                      <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded mx-2">
                        {group.error}
                      </div>
                    )}

                    {/* Tools List */}
                    {group.tools.length > 0 && group.isConnected && (
                      <div className="space-y-0.5 pl-2">
                        {group.tools.map((tool) => {
                          const isSelected = selectedMcpToolIds.has(tool.prefixedName);
                          return (
                            // biome-ignore lint/a11y/useSemanticElements: Complex flex layout requires div, has proper keyboard handling
                            <div
                              key={tool.prefixedName}
                              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
                                isSelected ? 'bg-accent/50' : ''
                              } ${!tool.isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                              onClick={() => {
                                if (tool.isAvailable) {
                                  handleToggleTool(tool.prefixedName);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (tool.isAvailable && (e.key === 'Enter' || e.key === ' ')) {
                                  e.preventDefault();
                                  handleToggleTool(tool.prefixedName);
                                }
                              }}
                              role="button"
                              tabIndex={tool.isAvailable ? 0 : -1}
                            >
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-primary border-primary' : 'border-input'
                                }`}
                              >
                                {isSelected && (
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{tool.name}</div>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-xs text-muted-foreground truncate cursor-help">
                                      {tool.description}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-sm">
                                    <div className="text-xs leading-relaxed">
                                      {tool.description}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* No Tools Message */}
                    {group.tools.length === 0 && group.isConnected && (
                      <div className="text-xs text-muted-foreground italic px-2 py-1">
                        {t.MCPServers.selector.noToolsFromServer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </HoverCard>
  );
}
