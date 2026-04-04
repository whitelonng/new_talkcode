import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, GitBranch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/hooks/use-locale';
import { getDocLinks } from '@/lib/doc-links';
import { useSettingsStore } from '@/stores/settings-store';

export function WorktreeSettings() {
  const { t } = useLocale();
  const [defaultWorktreeRoot, setDefaultWorktreeRoot] = useState<string>('');
  const worktreeRootPath = useSettingsStore((state) => state.worktree_root_path);
  const setWorktreeRootPath = useSettingsStore((state) => state.setWorktreeRootPath);

  useEffect(() => {
    invoke<string>('git_get_default_worktree_root')
      .then(setDefaultWorktreeRoot)
      .catch(console.error);
  }, []);

  const handleSelectWorktreeRoot = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t.Settings.worktree?.selectDirectory || 'Select Worktree Directory',
    });
    if (selected && typeof selected === 'string') {
      await setWorktreeRootPath(selected);
    }
  };

  const handleResetWorktreeRoot = async () => {
    await setWorktreeRootPath('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            <CardTitle className="text-lg">
              {t.Settings.worktree?.title || 'Worktree Settings'}
            </CardTitle>
            <HelpTooltip
              title={t.Settings.worktree?.tooltipTitle}
              description={t.Settings.worktree?.tooltipDescription}
              docUrl={getDocLinks().features.worktree}
            />
          </div>
          <CardDescription>
            {t.Settings.worktree?.description || 'Configure where worktree directories are stored'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t.Settings.worktree?.rootPath || 'Worktree Root Directory'}
            </Label>
            <div className="flex gap-2">
              <Input
                value={worktreeRootPath || defaultWorktreeRoot}
                placeholder={defaultWorktreeRoot}
                readOnly
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={handleSelectWorktreeRoot}>
                <FolderOpen className="h-4 w-4" />
              </Button>
              {worktreeRootPath && (
                <Button variant="outline" onClick={handleResetWorktreeRoot}>
                  {t.Common?.reset || 'Reset'}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {worktreeRootPath
                ? t.Settings.worktree?.customPathHint ||
                  'Using custom path. Click reset to use default.'
                : (t.Settings.worktree?.defaultPathHint || 'Using default path: {path}').replace(
                    '{path}',
                    defaultWorktreeRoot
                  )}
            </p>
          </div>

          {/* Path Preview */}
          <div className="rounded-md bg-muted p-3">
            <p className="mb-1 text-xs font-medium">
              {t.Settings.worktree?.pathPreview || 'Example worktree path:'}
            </p>
            <code className="text-xs">
              {worktreeRootPath || defaultWorktreeRoot}/project-name/pool-0
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
