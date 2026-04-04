import { CheckCircle2, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
    const newSelectedTools = new Set(selectedTools);
    if (checked) {
      newSelectedTools.add(toolId);
    } else {
      newSelectedTools.delete(toolId);
    }
    onToolsChange(Array.from(newSelectedTools));
  };

  // Filter out hidden tools
  const visibleTools = useMemo(
    () =>
      builtInTools.filter((tool) => {
        if (!isToolAllowedForAgent(agentId, tool.id)) return false;
        const ref = tool.ref as { hidden?: boolean } | undefined;
        return !ref?.hidden;
      }),
    [builtInTools, agentId]
  );

  const selectedCount = useMemo(
    () =>
      selectedTools.filter((tool) =>
        visibleTools.some(
          (t) => t.id === tool && !((t.ref as { hidden?: boolean } | undefined)?.hidden || false)
        )
      ).length,
    [selectedTools, visibleTools]
  );

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
                checked={selectedTools.includes(tool.id)}
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
