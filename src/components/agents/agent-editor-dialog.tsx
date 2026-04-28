import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { BuiltInToolsSelector } from '@/components/agents/built-in-tools-selector';
import { DynamicContextPanel } from '@/components/agents/dynamic-context-panel';
import { MCPToolsSelector } from '@/components/agents/mcp-tools-selector';
import { ModelTypeSelector } from '@/components/selectors/model-type-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { collapseBrowserControlToolIds } from '@/lib/tools/browser-control-tool-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocale } from '@/hooks/use-locale';
import { useSkills } from '@/hooks/use-skills';
import { logger } from '@/lib/logger';
import type { AgentDefinition } from '@/types/agent';
import { ModelType } from '@/types/model-types';

interface AgentEditorDialogProps {
  agent?: AgentDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (agentData: {
    id?: string;
    name: string;
    description?: string;
    modelType: ModelType;
    systemPrompt: string;
    selectedTools: string[];
    rules?: string;
    outputFormat?: string;
    dynamicEnabled: boolean;
    dynamicProviders: string[];
    dynamicVariables: Record<string, string>;
    dynamicProviderSettings?: Record<string, unknown>;
    defaultSkills: string[];
  }) => Promise<void>;
  onClose: () => void;
}

export function AgentEditorDialog({
  agent,
  open,
  onOpenChange,
  onSave,
  onClose,
}: AgentEditorDialogProps) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  // Generate unique IDs for form elements
  const nameId = useId();
  const descriptionId = useId();
  const rulesId = useId();
  const outputFormatId = useId();
  const systemPromptId = useId();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modelType, setModelType] = useState<ModelType>(ModelType.MAIN);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [rules, setRules] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [dynamicEnabled, setDynamicEnabled] = useState(false);
  const [dynamicProviders, setDynamicProviders] = useState<string[]>([
    'env',
    'global_memory',
    'project_memory',
    'agents_md',
  ]);
  const [dynamicVariables, setDynamicVariables] = useState<Record<string, string>>({});
  const [dynamicProviderSettings, setDynamicProviderSettings] = useState<Record<string, unknown>>(
    {}
  );
  const [defaultSkills, setDefaultSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [skillsPopoverOpen, setSkillsPopoverOpen] = useState(false);

  const { skills: allSkills, loading: skillsLoading } = useSkills();
  const selectedDefaultSkillIds = useMemo(() => new Set(defaultSkills), [defaultSkills]);
  const filteredSkills = useMemo(() => {
    const query = skillSearch.trim().toLowerCase();
    if (!query) {
      return allSkills;
    }

    return allSkills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.category.toLowerCase().includes(query)
    );
  }, [allSkills, skillSearch]);
  const toggleDefaultSkill = useCallback((skillId: string) => {
    setDefaultSkills((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  }, []);

  // Stable callback for DynamicContextPanel to prevent infinite re-renders
  const handleDynamicChange = useCallback(
    (dynamicPrompt: {
      enabled: boolean;
      providers: string[];
      variables: Record<string, string>;
      providerSettings?: Record<string, unknown>;
    }) => {
      setDynamicEnabled(dynamicPrompt.enabled);
      setDynamicProviders(dynamicPrompt.providers);
      setDynamicVariables(dynamicPrompt.variables);
      setDynamicProviderSettings(dynamicPrompt.providerSettings || {});
    },
    []
  );

  // Load agent data when editing
  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || '');
      // Use modelType if available, otherwise default to MAIN
      setModelType(agent.modelType ? agent.modelType : ModelType.MAIN);
      setSystemPrompt(
        typeof agent.systemPrompt === 'function' ? '' : (agent.systemPrompt as string)
      );
      setSelectedTools(collapseBrowserControlToolIds(Object.keys(agent.tools ?? {})));
      setRules(agent.rules || '');
      setOutputFormat(agent.outputFormat || '');
      setDynamicEnabled(agent.dynamicPrompt?.enabled ?? false);
      setDynamicProviders(
        agent.dynamicPrompt?.providers ?? ['env', 'global_memory', 'project_memory', 'agents_md']
      );
      setDynamicVariables(agent.dynamicPrompt?.variables ?? {});
      setDynamicProviderSettings(agent.dynamicPrompt?.providerSettings ?? {});
      setDefaultSkills(agent.defaultSkills ?? []);
    } else {
      // Reset form for new agent
      setName('');
      setDescription('');
      setModelType(ModelType.MAIN);
      setSystemPrompt('');
      setSelectedTools([]);
      setRules('');
      setOutputFormat('');
      setDynamicEnabled(false);
      setDynamicProviders(['env', 'global_memory', 'project_memory', 'agents_md']);
      setDynamicVariables({});
      setDynamicProviderSettings({});
      setDefaultSkills([]);
    }
  }, [agent]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error(t.Agents.form.nameRequired);
      return;
    }
    if (!systemPrompt.trim()) {
      toast.error(t.Agents.form.systemPromptRequired);
      return;
    }

    try {
      setSaving(true);

      const agentData = {
        id: agent?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        modelType,
        systemPrompt: systemPrompt.trim(),
        selectedTools,
        rules: rules.trim() || undefined,
        outputFormat: outputFormat.trim() || undefined,
        dynamicEnabled,
        dynamicProviders,
        dynamicVariables,
        dynamicProviderSettings,
        defaultSkills,
      };

      await onSave(agentData);
      toast.success(agent ? t.Agents.updated : t.Agents.created);
      onClose();
    } catch (error) {
      logger.error('Failed to save agent:', error);
      toast.error(t.Agents.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-fit min-w-4/5 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{agent ? t.Agents.editTitle : t.Agents.createTitle}</DialogTitle>
          <DialogDescription>
            {agent ? t.Agents.editDescription : t.Agents.createDescription}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b px-6">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="basic">{t.Agents.tabs.basic}</TabsTrigger>
              <TabsTrigger value="prompt">{t.Agents.tabs.prompt}</TabsTrigger>
              <TabsTrigger value="dynamic">{t.Agents.tabs.dynamic}</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-6">
            <TabsContent value="basic" className="mt-4 space-y-4">
              <div>
                <Label htmlFor={nameId}>{t.Agents.form.name} *</Label>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.Agents.form.namePlaceholder}
                />
              </div>

              <div>
                <Label htmlFor={descriptionId}>{t.Agents.form.description}</Label>
                <Textarea
                  id={descriptionId}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.Agents.form.descriptionPlaceholder}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="model-type">{t.Agents.form.modelType} *</Label>
                <ModelTypeSelector value={modelType} onValueChange={setModelType} label="" />
                <p className="text-xs text-muted-foreground mt-1">{t.Agents.form.modelTypeHint}</p>
              </div>

              <div>
                <Label htmlFor={rulesId}>{t.Agents.form.rules}</Label>
                <Textarea
                  id={rulesId}
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  placeholder={t.Agents.form.rulesPlaceholder}
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor={outputFormatId}>{t.Agents.form.outputFormat}</Label>
                <Textarea
                  id={outputFormatId}
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  placeholder={t.Agents.form.outputFormatPlaceholder}
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <Label>{t.Agents.form.defaultSkills}</Label>
                <p className="text-xs text-muted-foreground mb-2">{t.Agents.form.defaultSkillsHint}</p>
                {defaultSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {defaultSkills.map((id) => {
                      const skill = allSkills.find((s) => s.id === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1">
                          {skill?.name ?? id}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => setDefaultSkills((prev) => prev.filter((s) => s !== id))}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <Popover open={skillsPopoverOpen} onOpenChange={setSkillsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between"
                      disabled={skillsLoading}
                    >
                      <span className="truncate text-muted-foreground">
                        {skillsLoading
                          ? t.Skills.selector.loading
                          : defaultSkills.length > 0
                            ? `${defaultSkills.length} ${t.Skills.selector.active}`
                            : t.Agents.form.defaultSkillsPlaceholder}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-3 border-b">
                      <Input
                        placeholder={t.Agents.form.defaultSkillsPlaceholder}
                        value={skillSearch}
                        onChange={(e) => setSkillSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <ScrollArea className="h-64">
                      {skillsLoading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {t.Skills.selector.loading}
                        </div>
                      ) : filteredSkills.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {skillSearch
                            ? t.Skills.selector.noSkillsFound
                            : t.Skills.selector.noSkillsAvailable}
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {filteredSkills.map((skill) => {
                            const isSelected = selectedDefaultSkillIds.has(skill.id);
                            return (
                              <div
                                key={skill.id}
                                role="button"
                                tabIndex={0}
                                className={`flex items-center gap-2 rounded-md p-2 text-sm cursor-pointer hover:bg-accent ${
                                  isSelected ? 'bg-accent/50' : ''
                                }`}
                                onClick={() => toggleDefaultSkill(skill.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleDefaultSkill(skill.id);
                                  }
                                }}
                              >
                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                    isSelected ? 'bg-primary border-primary' : 'border-input'
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{skill.name}</div>
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
                  </PopoverContent>
                </Popover>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="mt-4 space-y-4">
              <div>
                <Label htmlFor={systemPromptId}>{t.Agents.form.systemPrompt} *</Label>
                <Textarea
                  id={systemPromptId}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={t.Agents.form.systemPromptPlaceholder}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t.Agents.form.systemPromptHint}
                </p>
              </div>

              <div className="space-y-4">
                <Label>{t.Agents.tools.available}</Label>
                <BuiltInToolsSelector
                  agentId={agent?.id}
                  selectedTools={selectedTools}
                  onToolsChange={setSelectedTools}
                />
                <MCPToolsSelector selectedTools={selectedTools} onToolsChange={setSelectedTools} />
              </div>
            </TabsContent>

            <TabsContent value="dynamic" className="mt-4 pb-4">
              <DynamicContextPanel
                agent={{
                  id: agent?.id || 'new-agent',
                  name: name,
                  description: description,
                  modelType: modelType,
                  systemPrompt: systemPrompt,
                  tools: {},
                  dynamicPrompt: {
                    enabled: dynamicEnabled,
                    providers: dynamicProviders,
                    variables: dynamicVariables,
                    providerSettings: dynamicProviderSettings,
                  },
                }}
                onChange={handleDynamicChange}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="p-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t.Common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t.Common.saving : agent ? t.Common.update : t.Common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
