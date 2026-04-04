// src/components/chat/skills-selector-button.tsx

import { Check, ExternalLink, Plus, Puzzle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/use-locale';
import { useSkills } from '@/hooks/use-skills';
import { getDocLinks } from '@/lib/doc-links';
import { logger } from '@/lib/logger';
import { useSkillsStore } from '@/stores/skills-store';

interface SkillsSelectorButtonProps {
  taskId?: string | null;
  onBrowseMarketplace?: () => void;
}

export function SkillsSelectorButton({
  taskId: _taskId,
  onBrowseMarketplace,
}: SkillsSelectorButtonProps) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all available skills
  const { skills: allSkills, loading } = useSkills();

  // Load active skills from store on mount
  const loadActiveSkills = useSkillsStore((state) => state.loadActiveSkills);
  const toggleSkill = useSkillsStore((state) => state.toggleSkill);
  const activeSkillIds = useSkillsStore((state) => state.activeSkillIds);

  useEffect(() => {
    loadActiveSkills();
  }, [loadActiveSkills]);

  // Filter skills by search query
  const filteredSkills = searchQuery
    ? allSkills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          skill.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allSkills;

  const handleToggleSkill = async (skillId: string) => {
    try {
      const isSelected = activeSkillIds.has(skillId);

      // Toggle skill in global active skills list
      await toggleSkill(skillId);

      toast.success(isSelected ? t.Skills.selector.skillRemoved : t.Skills.selector.skillAdded);
    } catch (error) {
      logger.error('Failed to toggle skill:', error);
      toast.error(t.Skills.selector.updateFailed);
    }
  };

  const activeCount = activeSkillIds.size;

  return (
    <HoverCard>
      <Popover open={open} onOpenChange={setOpen}>
        <HoverCardTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 relative" disabled={loading}>
              <Puzzle className="h-4 w-4" />
              {activeCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-72">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{t.Skills.selector.title}</h4>
            <p className="text-xs text-muted-foreground">{t.Skills.selector.description}</p>
            <a
              href={getDocLinks().features.skills}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {t.Skills.selector.learnMore}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </HoverCardContent>

        <PopoverContent className="w-80 p-0" align="start">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="font-semibold text-sm">{t.Skills.selector.title}</div>
            {activeCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {activeCount} {t.Skills.selector.active}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="p-3 border-b">
            <Input
              placeholder={t.Skills.selector.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>

          {/* Skills list */}
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t.Skills.selector.loading}
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? t.Skills.selector.noSkillsFound
                  : t.Skills.selector.noSkillsAvailable}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredSkills.map((skill) => {
                  const isActive = activeSkillIds.has(skill.id);
                  return (
                    /* biome-ignore lint/a11y/useSemanticElements: Complex flex layout requires div, has proper keyboard handling */
                    <div
                      key={skill.id}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
                        isActive ? 'bg-accent/50' : ''
                      }`}
                      onClick={() => handleToggleSkill(skill.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleSkill(skill.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'bg-primary border-primary' : 'border-input'
                        }`}
                      >
                        {isActive && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>

                      {skill.icon ? (
                        <img
                          src={skill.icon}
                          alt={skill.name}
                          className="w-6 h-6 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Puzzle className="h-3 w-3 text-primary" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{skill.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {skill.category}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {onBrowseMarketplace && (
            <>
              <Separator />
              <div className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    setOpen(false);
                    onBrowseMarketplace?.();
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {t.Skills.selector.browseMarketplace}
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </HoverCard>
  );
}
