import { CheckCircle2, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  BROWSER_CONTROL_TOOL_ID,
  BROWSER_CONTROL_SUBTOOLS,
  collapseBrowserControlToolIds,
  expandBrowserControlToolIds,
} from '@/lib/tools/browser-control-tool-group';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isToolAllowedForAgent } from '@/services/agents/agent-tool-access';
import { areToolsLoaded, getAvailableToolsForUISync } from '@/services/agents/tool-registry';

interface BuiltInToolsSelectorProps {
  agentId?: string;
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
}

export function BuiltInToolsSelector({
  agentId,
  selectedTools,
  onToolsChange,
}: BuiltInToolsSelectorProps) {
  // Get tools synchronously if already loaded, or wait for useEffect to set state
  const [toolsLoaded, setToolsLoaded] = useState(() => areToolsLoaded());

  // Wait for tools to be loaded before accessing them
  useEffect(() => {
    // Check immediately in case tools loaded after initial render
    if (areToolsLoaded() && !toolsLoaded) {
      setToolsLoaded(true);
      return;
    }

    if (!areToolsLoaded()) {
      const checkToolsLoaded = () => {
        if (areToolsLoaded()) {
          setToolsLoaded(true);
        } else {
          setTimeout(checkToolsLoaded, 100);
        }
      };
      const timer = setTimeout(checkToolsLoaded, 100);
      return () => clearTimeout(timer);
    }
  }, [toolsLoaded]);

  const builtInTools = useMemo(() => {
    if (!toolsLoaded || !areToolsLoaded()) return [];
    try {
      return getAvailableToolsForUISync();
    } catch {
      return [];
    }
  }, [toolsLoaded]);

  const handleToolToggle = (toolId: string, checked: boolean) => {
    const expandedSelectedTools = new Set(expandBrowserControlToolIds(selectedTools));

    if (toolId === BROWSER_CONTROL_TOOL_ID) {
      for (const subtoolId of BROWSER_CONTROL_SUBTOOLS) {
        if (checked) {
          expandedSelectedTools.add(subtoolId);
        } else {
          expandedSelectedTools.delete(subtoolId);
        }
      }
      onToolsChange(Array.from(expandedSelectedTools));
      return;
    }

    if (checked) {
      expandedSelectedTools.add(toolId);
    } else {
      expandedSelectedTools.delete(toolId);
    }
    onToolsChange(Array.from(expandedSelectedTools));
  };

  // Filter out hidden tools
  const visibleTools = useMemo(
    () => {
      const filtered = builtInTools.filter((tool) => {
        if (!isToolAllowedForAgent(agentId, tool.id)) return false;
        const ref = tool.ref as { hidden?: boolean } | undefined;
        return !ref?.hidden;
      });

      return collapseBrowserControlToolIds(filtered.map((tool) => tool.id))
        .map((toolId) => {
          if (toolId === BROWSER_CONTROL_TOOL_ID) {
            return filtered.find((tool) => tool.id === BROWSER_CONTROL_TOOL_ID) ?? {
              id: BROWSER_CONTROL_TOOL_ID,
              label: 'Browser Control',
              ref: undefined,
            };
          }
          return filtered.find((tool) => tool.id === toolId);
        })
        .filter(
          (tool): tool is { id: string; label: string; ref: unknown } => Boolean(tool)
        );
    },
    [builtInTools, agentId]
  );

  const selectedCount = useMemo(() => {
    const collapsedSelected = new Set(collapseBrowserControlToolIds(selectedTools));
    return visibleTools.filter((tool) => collapsedSelected.has(tool.id)).length;
  }, [selectedTools, visibleTools]);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Built-in Tools
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {selectedCount}/{visibleTools.length} selected
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Core tools available in all agents</p>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {visibleTools.map((tool) => (
            <label
              key={tool.id}
              className="flex items-start gap-2 text-xs p-2 rounded border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={new Set(collapseBrowserControlToolIds(selectedTools)).has(tool.id)}
                onChange={(e) => handleToolToggle(tool.id, e.target.checked)}
                className="mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                  <Wrench className="h-3 w-3 inline" />
                  <span className="truncate">{tool.label}</span>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">ID: {tool.id}</div>
              </div>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
