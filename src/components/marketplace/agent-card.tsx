// Marketplace agent card component

import type { RemoteAgentConfig } from '@talkcody/shared/types/remote-agents';
import { open } from '@tauri-apps/plugin-shell';
import { Bot, Download, ExternalLink, Github } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface MarketplaceAgentCardProps {
  agent: RemoteAgentConfig;
  onClick: () => void;
  onInstall?: (agent: RemoteAgentConfig) => void;
  isInstalling?: boolean;
}

export function MarketplaceAgentCard({
  agent,
  onClick,
  onInstall,
  isInstalling = false,
}: MarketplaceAgentCardProps) {
  const handleGithubClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    open(`https://github.com/${agent.repository}/tree/main/${agent.githubPath}`);
  };

  return (
    <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg truncate">{agent.name}</CardTitle>
              {agent.isBeta && (
                <Badge variant="default" className="shrink-0">
                  Beta
                </Badge>
              )}
              <Badge variant="outline" className="mt-0 shrink-0">
                {agent.category}
              </Badge>
            </div>

            <CardDescription className="text-xs line-clamp-2 mt-1">
              {agent.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardFooter className="gap-2">
        {/* GitHub repository link */}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group cursor-pointer"
          onClick={handleGithubClick}
          title={`View on GitHub: ${agent.githubPath}`}
        >
          <Github className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate max-w-[150px]">{agent.repository}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <div className="flex-1" />

        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onInstall?.(agent);
          }}
          disabled={isInstalling || !onInstall}
        >
          {isInstalling ? (
            'Installing...'
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Install
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
