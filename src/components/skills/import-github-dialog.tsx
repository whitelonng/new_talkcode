/**
 * Import GitHub Skills Dialog
 */

import { AlertCircle, CheckCircle2, Circle, Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useTranslation } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import {
  GitHubImporter,
  type GitHubRepoInfo,
  type GitHubSkillInfo,
} from '@/services/skills/github-importer';

interface ImportGitHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

type DialogStep = 'input' | 'scanning' | 'selection' | 'importing' | 'result';

export function ImportGitHubDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ImportGitHubDialogProps) {
  const t = useTranslation();
  const urlInputId = useId();

  const [step, setStep] = useState<DialogStep>('input');
  const [githubUrl, setGithubUrl] = useState('');
  const [_repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null);
  const [skills, setSkills] = useState<GitHubSkillInfo[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    succeeded: string[];
    failed: Array<{ name: string; error: string }>;
  } | null>(null);
  const [tempClonePath, setTempClonePath] = useState<string | undefined>(undefined);

  // Clean up temp clone directory
  const cleanupTempClone = useCallback(async () => {
    if (tempClonePath) {
      try {
        const { remove } = await import('@tauri-apps/plugin-fs');
        await remove(tempClonePath, { recursive: true });
        logger.info('Cleaned up temporary clone directory');
        setTempClonePath(undefined);
      } catch (error) {
        logger.warn('Failed to clean up temp directory:', error);
      }
    }
  }, [tempClonePath]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('input');
      setGithubUrl('');
      setRepoInfo(null);
      setSkills([]);
      setSelectedSkills(new Set());
      setError(null);
      setImportResult(null);
    } else {
      // Clean up when dialog closes
      cleanupTempClone();
    }
  }, [open, cleanupTempClone]);

  const handleScan = useCallback(async () => {
    if (!githubUrl.trim()) {
      setError(t.Skills.githubImport.urlRequired);
      return;
    }

    setError(null);
    setStep('scanning');

    try {
      // Parse GitHub URL
      const parsedInfo = GitHubImporter.parseGitHubUrl(githubUrl);
      if (!parsedInfo) {
        setError(t.Skills.githubImport.invalidUrl);
        setStep('input');
        return;
      }

      setRepoInfo(parsedInfo);
      logger.info('Parsed GitHub URL:', parsedInfo);

      // Scan for skills
      const { skills: foundSkills, tempClonePath: clonePath } =
        await GitHubImporter.scanGitHubDirectory(parsedInfo);

      if (foundSkills.length === 0) {
        setError(t.Skills.githubImport.noSkillsFound);
        setStep('input');
        return;
      }

      setSkills(foundSkills);
      setTempClonePath(clonePath);

      // Auto-select all valid skills
      const validSkillNames = new Set(foundSkills.filter((s) => s.isValid).map((s) => s.skillName));
      setSelectedSkills(validSkillNames);

      setStep('selection');
      logger.info(`Found ${foundSkills.length} skills`);
    } catch (error) {
      logger.error('Failed to scan GitHub repository:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(t.Skills.githubImport.networkError);
      }
      setStep('input');
    }
  }, [githubUrl, t]);

  const toggleSkill = (skillName: string) => {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(skillName)) {
      newSelected.delete(skillName);
    } else {
      newSelected.add(skillName);
    }
    setSelectedSkills(newSelected);
  };

  const toggleAll = () => {
    if (selectedSkills.size === skills.length) {
      setSelectedSkills(new Set());
    } else {
      setSelectedSkills(new Set(skills.map((s) => s.skillName)));
    }
  };

  const handleImport = async () => {
    if (selectedSkills.size === 0) return;

    setStep('importing');

    try {
      const skillsToImport = skills.filter((s) => selectedSkills.has(s.skillName));
      const result = await GitHubImporter.importMultipleSkills(skillsToImport, tempClonePath);

      // Clean up after successful import
      setTempClonePath(undefined);

      setImportResult(result);
      setStep('result');

      if (result.succeeded.length > 0) {
        onImportComplete?.();
      }
    } catch (error) {
      logger.error('Import failed:', error);
      setError(error instanceof Error ? error.message : t.Skills.githubImport.networkError);
      setStep('selection');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleTryAgain = () => {
    setStep('input');
    setGithubUrl('');
    setRepoInfo(null);
    setSkills([]);
    setSelectedSkills(new Set());
    setError(null);
    setImportResult(null);
  };

  const renderStepContent = () => {
    switch (step) {
      case 'input':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={urlInputId}>{t.Skills.githubImport.urlLabel}</Label>
              <Input
                id={urlInputId}
                placeholder={t.Skills.githubImport.urlPlaceholder}
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScan();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">{t.Skills.githubImport.urlHint}</p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'scanning':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t.Skills.githubImport.scanning}</p>
          </div>
        );

      case 'selection':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {typeof t.Skills.githubImport.foundSkills === 'function'
                  ? t.Skills.githubImport.foundSkills(skills.length)
                  : `Found ${skills.length} skills`}
              </p>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedSkills.size === skills.length
                  ? t.Skills.githubImport.deselectAll
                  : t.Skills.githubImport.selectAll}
              </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {skills.map((skill) => (
                <button
                  key={skill.skillName}
                  type="button"
                  onClick={() => toggleSkill(skill.skillName)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                >
                  {selectedSkills.has(skill.skillName) ? (
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{skill.skillName}</div>
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {skill.description}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>👤 {skill.author}</span>
                      {skill.hasReferencesDir && <span>📄 References</span>}
                      {skill.hasScriptsDir && <span>📜 Scripts</span>}
                      {skill.hasAssetsDir && <span>🎨 Assets</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'importing':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t.Skills.githubImport.importing || 'Importing skills...'}
            </p>
          </div>
        );

      case 'result':
        return (
          <div className="space-y-4">
            {importResult && importResult.succeeded.length > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {typeof t.Skills.githubImport.importSuccess === 'function'
                    ? t.Skills.githubImport.importSuccess(importResult.succeeded.length)
                    : `Successfully imported ${importResult.succeeded.length} skill(s)`}
                </AlertDescription>
              </Alert>
            )}

            {importResult && importResult.failed.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div>
                    {typeof t.Skills.githubImport.importFailed === 'function'
                      ? t.Skills.githubImport.importFailed(importResult.failed.length)
                      : `Failed to import ${importResult.failed.length} skill(s)`}
                  </div>
                  <ul className="list-disc list-inside mt-2 text-xs space-y-1">
                    {importResult.failed.map((f) => (
                      <li key={f.name}>
                        <span className="font-medium">{f.name}:</span> {f.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderFooter = () => {
    switch (step) {
      case 'input':
        return (
          <>
            <Button variant="outline" onClick={handleClose}>
              {t.Skills.githubImport.cancel || 'Cancel'}
            </Button>
            <Button onClick={handleScan} disabled={!githubUrl.trim()}>
              <Download className="h-4 w-4 mr-2" />
              {t.Skills.githubImport.scan || 'Scan'}
            </Button>
          </>
        );

      case 'scanning':
        return (
          <Button variant="outline" onClick={handleClose} disabled>
            {t.Skills.githubImport.cancel || 'Cancel'}
          </Button>
        );

      case 'selection':
        return (
          <>
            <Button variant="outline" onClick={handleTryAgain}>
              {t.Skills.githubImport.back || 'Back'}
            </Button>
            <Button onClick={handleImport} disabled={selectedSkills.size === 0}>
              {t.Skills.githubImport.import || 'Import'} ({selectedSkills.size})
            </Button>
          </>
        );

      case 'importing':
        return (
          <Button variant="outline" onClick={handleClose} disabled>
            {t.Skills.githubImport.close || 'Close'}
          </Button>
        );

      case 'result':
        return (
          <>
            <Button variant="outline" onClick={handleTryAgain}>
              {t.Skills.githubImport.importMore || 'Import More'}
            </Button>
            <Button onClick={handleClose}>{t.Skills.githubImport.close || 'Close'}</Button>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t.Skills.githubImport.title}</DialogTitle>
          <DialogDescription>{t.Skills.githubImport.description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">{renderStepContent()}</div>

        <DialogFooter>{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
