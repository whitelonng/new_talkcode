// src/components/skills/skill-card.tsx

import { open } from '@tauri-apps/plugin-shell';
import {
  BookOpen,
  Code,
  Download,
  ExternalLink,
  FileText,
  Folder,
  GitFork,
  Github,
  Info,
  Pencil,
  RefreshCw,
  Scale,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Skill } from '@/types/skill';

interface SkillCardProps {
  skill: Skill;
  onClick?: () => void;
  onToggle?: (skill: Skill) => void;
  isActive?: boolean;
  isToggling?: boolean;
  showActions?: boolean;
  // Action buttons
  onEdit?: () => void;
  onDelete?: () => void;
  onFork?: () => void;
  onShare?: () => void;
  onInstall?: (skill: Skill) => void;
  isInstalling?: boolean;
}

export function SkillCard({
  skill,
  onClick,
  onToggle,
  isActive = false,
  isToggling = false,
  showActions = true,
  onEdit,
  onDelete,
  onFork,
  onShare,
  onInstall,
  isInstalling = false,
}: SkillCardProps) {
  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle(skill);
    }
  };

  // Check which content the skill has
  const hasSystemPrompt = Boolean(skill.content?.systemPromptFragment);
  const hasWorkflowRules = Boolean(skill.content?.workflowRules);
  const hasDocumentation = Boolean(
    skill.content?.documentation && skill.content.documentation.length > 0
  );
  const hasScripts = Boolean(skill.content?.hasScripts);
  const _hasReferences = Boolean(skill.content?.hasReferences);
  const _hasAssets = Boolean(skill.content?.hasAssets);
  const hasScriptsDir = Boolean(skill.content?.hasScriptsDir);
  const hasReferencesDir = Boolean(skill.content?.hasReferencesDir);
  const hasAssetsDir = Boolean(skill.content?.hasAssetsDir);

  // Determine skill type
  const isBuiltIn = skill.metadata.isBuiltIn;
  const isMarketplace = Boolean(skill.marketplace?.marketplaceId);
  // const isLocalCustom = !isBuiltIn && !isMarketplace;
  const sourceType =
    skill.metadata.sourceType || (isMarketplace ? 'marketplace' : isBuiltIn ? 'system' : 'local');

  return (
    <Card
      className={`hover:bg-accent transition-colors ${isActive ? 'border-primary border-2' : ''}`}
      onClick={handleCardClick}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          {skill.icon ? (
            <img src={skill.icon} alt={skill.name} className="w-12 h-12 rounded-md object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg truncate">{skill.name}</CardTitle>
              {sourceType === 'system' && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  System
                </Badge>
              )}
              {isActive && (
                <Badge variant="default" className="shrink-0 text-xs bg-green-600">
                  Active
                </Badge>
              )}
              {skill.metadata.isShared && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  Shared
                </Badge>
              )}
            </div>

            <Badge variant="outline" className="mt-1 text-xs">
              {skill.category}
            </Badge>

            {/* License Badge */}
            {skill.license && (
              <Badge variant="outline" className="mt-1 text-xs">
                <Scale className="h-3 w-3 mr-1" />
                {skill.license}
              </Badge>
            )}

            {/* Compatibility Tooltip */}
            {skill.compatibility && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="mt-1 text-xs cursor-help">
                    <Info className="h-3 w-3 mr-1" />
                    Compatible
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{skill.compatibility}</p>
                </TooltipContent>
              </Tooltip>
            )}

            <CardDescription className="text-xs line-clamp-4 mt-2">
              {skill.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Content indicators */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          {hasSystemPrompt && (
            <div className="flex items-center gap-1" title="System Prompt">
              <FileText className="h-3 w-3" />
              Prompt
            </div>
          )}
          {hasWorkflowRules && (
            <div className="flex items-center gap-1" title="Workflow Rules">
              <Workflow className="h-3 w-3" />
              Workflow
            </div>
          )}
          {hasDocumentation && (
            <div className="flex items-center gap-1" title="Documentation">
              <BookOpen className="h-3 w-3" />
              Docs ({skill.content?.documentation?.length || 0})
            </div>
          )}
          {hasScripts && (
            <div className="flex items-center gap-1" title="Executable Scripts">
              <Zap className="h-3 w-3" />
              {skill.content?.scriptFiles && skill.content.scriptFiles.length > 0
                ? `Scripts: ${skill.content.scriptFiles.join(', ')}`
                : 'Scripts'}
            </div>
          )}
          {hasScriptsDir && (
            <div className="flex items-center gap-1" title="Scripts Directory">
              <Code className="h-3 w-3" />
              Scripts
            </div>
          )}
          {hasReferencesDir && (
            <div className="flex items-center gap-1" title="References Directory">
              <BookOpen className="h-3 w-3" />
              References
            </div>
          )}
          {hasAssetsDir && (
            <div className="flex items-center gap-1" title="Assets Directory">
              <Folder className="h-3 w-3" />
              Assets
            </div>
          )}
        </div>

        {/* Tags */}
        {skill.metadata.tags && skill.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skill.metadata.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {skill.metadata.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{skill.metadata.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      {showActions && (
        <CardFooter className="flex-col gap-3 pt-0">
          {/* Action buttons row */}
          <div className="flex items-center justify-center gap-2 w-full">
            {!isBuiltIn && onEdit && (
              <button
                type="button"
                className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-md hover:bg-primary/10 transition-all group"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="Edit Skill"
              >
                <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Edit
                </span>
              </button>
            )}

            {onFork && (
              <button
                type="button"
                className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-md hover:bg-primary/10 transition-all group"
                onClick={(e) => {
                  e.stopPropagation();
                  onFork();
                }}
                title="Fork Skill"
              >
                <GitFork className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Fork
                </span>
              </button>
            )}

            {!isBuiltIn && onDelete && (
              <button
                type="button"
                className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-md hover:bg-destructive/10 transition-all group"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete Skill"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                <span className="text-xs text-muted-foreground group-hover:text-destructive transition-colors">
                  Delete
                </span>
              </button>
            )}
          </div>

          {/* Primary action buttons */}
          <div className="flex gap-2 w-full items-center justify-between">
            {/* GitHub link for remote skills */}
            {sourceType === 'remote' && skill.metadata.repository && skill.metadata.githubPath ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  open(
                    `https://github.com/${skill.metadata.repository}/tree/main/${skill.metadata.githubPath}`
                  );
                }}
                title={`View on GitHub: ${skill.metadata.githubPath}`}
              >
                <Github className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[150px]">{skill.metadata.repository}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              {onInstall ? (
                <Button
                  variant="default"
                  size="sm"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInstall(skill);
                  }}
                  disabled={isInstalling}
                >
                  {isInstalling ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Install
                    </>
                  )}
                </Button>
              ) : null}
              {onToggle && (
                <Button
                  variant={isActive ? 'secondary' : 'default'}
                  size="sm"
                  onClick={handleToggleClick}
                  disabled={isToggling}
                >
                  {isToggling ? 'Loading...' : isActive ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

export function SkillCardCompact({
  skill,
  isActive = false,
  onToggle,
}: {
  skill: Skill;
  isActive?: boolean;
  onToggle?: (skill: Skill) => void;
}) {
  const handleToggle = () => {
    if (onToggle) {
      onToggle(skill);
    }
  };

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 p-3 rounded-lg border border-0 cursor-pointer text-left hover:bg-accent transition-colors ${
        isActive ? 'border-primary bg-accent/50' : ''
      }`}
      onClick={handleToggle}
    >
      {skill.icon ? (
        <img src={skill.icon} alt={skill.name} className="w-8 h-8 rounded object-cover" />
      ) : (
        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{skill.name}</div>
        <div className="text-xs text-muted-foreground truncate">{skill.category}</div>
      </div>

      {isActive && (
        <Badge variant="default" className="shrink-0 text-xs">
          Active
        </Badge>
      )}
    </button>
  );
}
