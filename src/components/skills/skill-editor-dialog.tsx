// Skill editor dialog for creating/editing skills

import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { FileCode, Trash2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import type { DocumentationItem, Skill } from '@/types/skill';
import { AssetsManager } from './assets-manager';
import { DocumentationEditor } from './documentation-editor';
import { MetadataEditor } from './metadata-editor';
import { ReferencesManager } from './references-manager';

interface SkillEditorDialogProps {
  skill?: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (skillData: Partial<Skill>) => Promise<void>;
  onClose: () => void;
}

const SKILL_CATEGORIES = [
  'Database',
  'Web Development',
  'DevOps',
  'Machine Learning',
  'Data Science',
  'Cloud',
  'Testing',
  'Security',
  'Mobile',
  'General',
];

const LICENSE_OPTIONS = [
  { label: 'MIT', value: 'MIT' },
  { label: 'Apache-2.0', value: 'Apache-2.0' },
  { label: 'GPL-3.0', value: 'GPL-3.0' },
  { label: 'BSD-3-Clause', value: 'BSD-3-Clause' },
  { label: 'BSD-2-Clause', value: 'BSD-2-Clause' },
  { label: 'LGPL-3.0', value: 'LGPL-3.0' },
  { label: 'MPL-2.0', value: 'MPL-2.0' },
  { label: 'AGPL-3.0', value: 'AGPL-3.0' },
  { label: 'Unlicense', value: 'Unlicense' },
  { label: 'Custom', value: 'Custom' },
];

export function SkillEditorDialog({
  skill,
  open,
  onOpenChange,
  onSave,
  onClose,
}: SkillEditorDialogProps) {
  const nameId = useId();
  const descriptionId = useId();
  const longDescriptionId = useId();
  const categoryId = useId();
  const licenseId = useId();
  const compatibilityId = useId();
  const iconId = useId();
  const tagsId = useId();
  const systemPromptId = useId();
  const workflowRulesId = useId();

  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [license, setLicense] = useState('');
  const [compatibility, setCompatibility] = useState('');
  const [frontmatterMetadata, setFrontmatterMetadata] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [systemPromptFragment, setSystemPromptFragment] = useState('');
  const [workflowRules, setWorkflowRules] = useState('');
  const [documentation, setDocumentation] = useState<DocumentationItem[]>([]);
  const [icon, setIcon] = useState('');

  // Script management state
  const [scriptFiles, setScriptFiles] = useState<string[]>([]);
  const [scriptContents, setScriptContents] = useState<Map<string, string>>(new Map());
  const [selectingScripts, setSelectingScripts] = useState(false);

  // References and Assets state
  const [references, setReferences] = useState<Array<{ filename: string; content: string }>>([]);
  const [assets, setAssets] = useState<
    Array<{ filename: string; content: Uint8Array; size: number }>
  >([]);

  // Load skill data when editing
  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setDescription(skill.description);
      setLongDescription(skill.longDescription || '');
      setCategory(skill.category);
      setLicense(skill.license || '');
      setCompatibility(skill.compatibility || '');
      // Extract frontmatter metadata from skill (if it's an AgentSkill)
      setFrontmatterMetadata(skill.frontmatterMetadata || {});
      setTags(skill.metadata.tags || []);
      setSystemPromptFragment(skill.content.systemPromptFragment || '');
      setWorkflowRules(skill.content.workflowRules || '');
      setDocumentation(skill.content.documentation || []);
      setIcon(skill.icon || '');
      setScriptFiles(skill.content.scriptFiles || []);
    } else {
      // Reset form for new skill
      setName('');
      setDescription('');
      setLongDescription('');
      setCategory('General');
      setLicense('');
      setCompatibility('');
      setFrontmatterMetadata({});
      setTags([]);
      setSystemPromptFragment('');
      setWorkflowRules('');
      setDocumentation([]);
      setIcon('');
      setScriptFiles([]);
      setScriptContents(new Map());
    }
  }, [skill]);

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // Script management handlers
  const handleSelectScripts = async () => {
    try {
      setSelectingScripts(true);

      const selected = await openDialog({
        multiple: true,
        filters: [
          {
            name: 'Scripts',
            extensions: ['py', 'sh', 'js', 'ts', 'mjs'],
          },
        ],
      });

      if (!selected) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const newScripts: string[] = [];
      const newContents = new Map(scriptContents);

      for (const filePath of filePaths) {
        // Extract filename from path
        const filename = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';

        // Check if already exists
        if (scriptFiles.includes(filename)) {
          toast.error(`Script ${filename} is already added`);
          continue;
        }

        // Read file content
        try {
          const content = await readTextFile(filePath);
          newScripts.push(filename);
          newContents.set(filename, content);
        } catch (error) {
          logger.error(`Failed to read script file ${filename}:`, error);
          toast.error(`Failed to read ${filename}`);
        }
      }

      if (newScripts.length > 0) {
        setScriptFiles([...scriptFiles, ...newScripts]);
        setScriptContents(newContents);
        toast.success(`Added ${newScripts.length} script${newScripts.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Failed to select script files:', error);
      toast.error('Failed to select scripts');
    } finally {
      setSelectingScripts(false);
    }
  };

  const handleDeleteScript = (filename: string) => {
    if (!confirm(`Are you sure you want to remove ${filename}?`)) {
      return;
    }

    setScriptFiles(scriptFiles.filter((f) => f !== filename));
    const newContents = new Map(scriptContents);
    newContents.delete(filename);
    setScriptContents(newContents);
  };

  const getScriptType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py':
        return 'Python';
      case 'sh':
        return 'Bash';
      case 'js':
      case 'mjs':
        return 'JavaScript';
      case 'ts':
        return 'TypeScript';
      default:
        return 'Unknown';
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error('Skill name is required');
      return;
    }
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }

    try {
      setSaving(true);

      const skillData: Partial<Skill> = {
        name: name.trim(),
        description: description.trim(),
        longDescription: longDescription.trim() || undefined,
        category,
        license: license.trim() || undefined,
        compatibility: compatibility.trim() || undefined,
        icon: icon.trim() || undefined,
        // Save frontmatter metadata (per Agent Skills Specification)
        frontmatterMetadata:
          Object.keys(frontmatterMetadata).length > 0 ? frontmatterMetadata : undefined,
        content: {
          systemPromptFragment: systemPromptFragment.trim() || undefined,
          workflowRules: workflowRules.trim() || undefined,
          documentation: documentation.length > 0 ? documentation : undefined,
          hasScripts: scriptFiles.length > 0,
          scriptFiles: scriptFiles.length > 0 ? scriptFiles : undefined,
          scriptContents: scriptFiles.length > 0 ? scriptContents : undefined,
        },
        metadata: {
          tags,
          isBuiltIn: false,
          createdAt: skill?.metadata.createdAt || Date.now(),
          updatedAt: Date.now(),
          lastUsed: skill?.metadata.lastUsed,
        },
      };

      await onSave(skillData);
      toast.success(skill ? 'Skill updated successfully' : 'Skill created successfully');
      onClose();
    } catch (error) {
      logger.error('Failed to save skill:', error);
      toast.error('Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-fit min-w-4/5 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{skill ? 'Edit Skill' : 'Create New Skill'}</DialogTitle>
          <DialogDescription>
            {skill
              ? 'Update your skill information and content'
              : 'Create a new domain knowledge skill for your projects'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b px-6">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="documentation">Documentation</TabsTrigger>
              <TabsTrigger value="scripts">Scripts</TabsTrigger>
              <TabsTrigger value="references">References</TabsTrigger>
              <TabsTrigger value="assets">Assets</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-6">
            <TabsContent value="basic" className="mt-4 space-y-4">
              <div>
                <Label htmlFor={nameId}>Name *</Label>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Database Development"
                />
              </div>

              <div>
                <Label htmlFor={descriptionId}>Short Description *</Label>
                <Textarea
                  id={descriptionId}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this skill (1-2 sentences)"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor={longDescriptionId}>Long Description</Label>
                <Textarea
                  id={longDescriptionId}
                  value={longDescription}
                  onChange={(e) => setLongDescription(e.target.value)}
                  placeholder="Detailed description of what this skill provides..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor={categoryId}>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id={categoryId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={licenseId}>License</Label>
                  <Select value={license} onValueChange={setLicense}>
                    <SelectTrigger id={licenseId}>
                      <SelectValue placeholder="Select license" />
                    </SelectTrigger>
                    <SelectContent>
                      {LICENSE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={iconId}>Icon URL</Label>
                  <Input
                    id={iconId}
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="https://example.com/icon.png"
                    type="url"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={compatibilityId}>Compatibility</Label>
                <Textarea
                  id={compatibilityId}
                  value={compatibility}
                  onChange={(e) => setCompatibility(e.target.value)}
                  placeholder="e.g., Requires Python 3.8+, git, Node.js 18+"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {compatibility.length}/500 characters
                </p>
              </div>

              {/* Frontmatter Metadata Editor */}
              <div className="border-t pt-4">
                <MetadataEditor value={frontmatterMetadata} onChange={setFrontmatterMetadata} />
              </div>

              <div>
                <Label htmlFor={tagsId}>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id={tagsId}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add a tag and press Enter"
                  />
                  <Button type="button" onClick={handleAddTag}>
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="content" className="mt-4 space-y-4">
              <div>
                <Label htmlFor={systemPromptId}>System Prompt Fragment</Label>
                <Textarea
                  id={systemPromptId}
                  value={systemPromptFragment}
                  onChange={(e) => setSystemPromptFragment(e.target.value)}
                  placeholder="Additional context and knowledge to add to the system prompt..."
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be injected into the AI's system prompt when the skill is active
                </p>
              </div>

              <div>
                <Label htmlFor={workflowRulesId}>Workflow Rules</Label>
                <Textarea
                  id={workflowRulesId}
                  value={workflowRules}
                  onChange={(e) => setWorkflowRules(e.target.value)}
                  placeholder="Specific workflow instructions and best practices..."
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Guidelines and procedures for working with this domain
                </p>
              </div>
            </TabsContent>

            <TabsContent value="documentation" className="mt-4 pb-4">
              <DocumentationEditor documentation={documentation} onChange={setDocumentation} />
            </TabsContent>

            {/* Scripts Tab */}
            <TabsContent value="scripts" className="mt-4 space-y-4 pb-4">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Script Management</h3>
                    <p className="text-sm text-muted-foreground">
                      Select script files to include with this skill. Scripts will be copied to the
                      skill's scripts/ directory.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectScripts}
                    disabled={selectingScripts}
                  >
                    <FileCode className="h-4 w-4 mr-2" />
                    {selectingScripts ? 'Selecting...' : 'Select Scripts'}
                  </Button>
                </div>

                {/* Script List */}
                {scriptFiles.length > 0 ? (
                  <div className="space-y-2">
                    {scriptFiles.map((filename) => (
                      <div key={filename} className="border rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileCode className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium text-sm">{filename}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({getScriptType(filename)})
                              </span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteScript(filename)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-8 border rounded-md border-dashed">
                    No scripts added yet. Click "Select Scripts" to add scripts.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* References Tab */}
            <TabsContent value="references" className="mt-4 pb-4">
              <ReferencesManager value={references} onChange={setReferences} />
            </TabsContent>

            {/* Assets Tab */}
            <TabsContent value="assets" className="mt-4 pb-4">
              <AssetsManager value={assets} onChange={setAssets} />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="p-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : skill ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
