import { Check, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-locale';
import type { LintDiagnostic } from '@/services/lint-service';

interface QuickFixMenuProps {
  diagnostic: LintDiagnostic;
  isOpen: boolean;
  onClose: () => void;
  onFixApply: (fixId: string) => Promise<void>;
}

// Map diagnostic codes to fix option keys
const fixOptionsMap: Record<
  string,
  { id: string; titleKey: string; descKey: string; isAutoFixable: boolean }[]
> = {
  'no-unused-variables': [
    {
      id: 'remove-variable',
      titleKey: 'removeVariable',
      descKey: 'removeVariableDesc',
      isAutoFixable: true,
    },
  ],
  'no-unused-imports': [
    {
      id: 'remove-imports',
      titleKey: 'removeImports',
      descKey: 'removeImportsDesc',
      isAutoFixable: true,
    },
  ],
  'use-const': [
    {
      id: 'convert-to-const',
      titleKey: 'convertToConst',
      descKey: 'convertToConstDesc',
      isAutoFixable: true,
    },
  ],
  'no-explicit-any': [
    {
      id: 'add-type-annotation',
      titleKey: 'addTypeAnnotation',
      descKey: 'addTypeAnnotationDesc',
      isAutoFixable: false,
    },
  ],
  'prefer-const': [
    {
      id: 'convert-to-const',
      titleKey: 'convertToConst',
      descKey: 'convertToConstDesc',
      isAutoFixable: true,
    },
  ],
  'no-empty-function': [
    { id: 'add-comment', titleKey: 'addComment', descKey: 'addCommentDesc', isAutoFixable: true },
  ],
};

export function QuickFixMenu({ diagnostic, isOpen, onClose, onFixApply }: QuickFixMenuProps) {
  const t = useTranslation();
  const [isApplying, setIsApplying] = useState(false);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  // Get available fixes for this diagnostic with translations
  const availableFixes = useMemo(() => {
    const fixOptions = fixOptionsMap[diagnostic.code || ''];
    if (fixOptions) {
      return fixOptions.map((opt) => ({
        id: opt.id,
        title: t.Lint.fixes[opt.titleKey as keyof typeof t.Lint.fixes] || opt.titleKey,
        description: t.Lint.fixes[opt.descKey as keyof typeof t.Lint.fixes] || opt.descKey,
        isAutoFixable: opt.isAutoFixable,
      }));
    }
    // Default fallback
    return [
      {
        id: 'ignore-diagnostic',
        title: t.Lint.fixes.ignoreDiagnostic,
        description: t.Lint.fixes.ignoreDiagnosticDesc,
        isAutoFixable: true,
      },
    ];
  }, [diagnostic.code, t]);

  const handleFixClick = async (fix: {
    id: string;
    title: string;
    description: string;
    isAutoFixable: boolean;
  }) => {
    if (isApplying) return;

    setIsApplying(true);
    setApplyingFix(fix.id);

    try {
      await onFixApply(fix.id);
      onClose();
    } catch (error) {
      console.error('Failed to apply fix:', error);
    } finally {
      setIsApplying(false);
      setApplyingFix(null);
    }
  };

  if (!isOpen) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={onClose}>
      <DropdownMenuTrigger asChild>
        <div className="absolute inset-0 cursor-pointer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          {t.Lint.quickFix}
        </div>
        <DropdownMenuSeparator />

        {availableFixes.map((fix) => (
          <DropdownMenuItem
            key={fix.id}
            onClick={() => handleFixClick(fix)}
            disabled={isApplying}
            className="flex flex-col items-start gap-1 p-3"
          >
            <div className="flex items-center gap-2 w-full">
              {isApplying && applyingFix === fix.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span className="font-medium">{fix.title}</span>
            </div>
            <span className="text-xs text-muted-foreground ml-6">{fix.description}</span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onClose}
          disabled={isApplying}
          className="flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          {t.Lint.fixes.cancel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
