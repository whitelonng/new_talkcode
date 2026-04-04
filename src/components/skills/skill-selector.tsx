// src/components/skills/skill-selector.tsx

import { Check, ChevronDown, Plus, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useConversationSkills, useSkills } from '@/hooks/use-skills';
import { logger } from '@/lib/logger';

interface SkillSelectorProps {
  conversationId: string | null;
  onBrowseMarketplace?: () => void;
}

export function SkillSelector({ conversationId, onBrowseMarketplace }: SkillSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all available skills
  const { skills: allSkills, loading: loadingAll } = useSkills();

  // Load conversation skills
  const {
    skills: activeSkills,
    loading: loadingConversation,
    toggleSkill,
  } = useConversationSkills(conversationId);

  const loading = loadingAll || loadingConversation;

  // Get active skill IDs for quick lookup
  const activeSkillIds = new Set(activeSkills.map((skill) => skill.id));

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
    if (!conversationId) {
      toast.error('No active conversation');
      return;
    }

    try {
      const enabled = await toggleSkill(skillId);
      toast.success(
        enabled
          ? 'Skill activated for this conversation'
          : 'Skill deactivated for this conversation'
      );
    } catch (error) {
      logger.error('Failed to toggle skill:', error);
      toast.error('Failed to toggle skill');
    }
  };

  const activeCount = activeSkillIds.size;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2"
          disabled={!conversationId || loading}
        >
          <Zap className="h-4 w-4" />
          <span className="text-sm">Skills {activeCount > 0 && `(${activeCount})`}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="font-semibold text-sm">Active Skills</div>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeCount} active
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Skills list */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading skills...</div>
          ) : filteredSkills.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchQuery ? 'No skills found' : 'No skills available'}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredSkills.map((skill) => {
                const isActive = activeSkillIds.has(skill.id);
                return (
                  <div
                    key={skill.id}
                    role="button"
                    tabIndex={0}
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
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isActive ? 'bg-primary border-primary' : 'border-input'
                      }`}
                    >
                      {isActive && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>

                    {skill.icon ? (
                      <img
                        src={skill.icon}
                        alt={skill.name}
                        className="w-6 h-6 rounded object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                        <Zap className="h-3 w-3 text-primary" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{skill.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{skill.category}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
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
            Browse Skills Marketplace
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
