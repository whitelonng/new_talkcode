// TalkCody Free Login Dialog
// Prompts users to sign in with GitHub or Google, or use their own API Key

import { SiGoogle } from '@icons-pack/react-simple-icons';
import { platform } from '@tauri-apps/plugin-os';
import { Copy, Github, Settings, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
import { useUiNavigation } from '@/contexts/ui-navigation';
import type { SupportedLocale } from '@/locales';
import { getLocale } from '@/locales';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { NavigationView } from '@/types/navigation';

interface TalkCodyFreeLoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TalkCodyFreeLoginDialog({ open, onClose }: TalkCodyFreeLoginDialogProps) {
  const { setActiveView } = useUiNavigation();
  const language = useSettingsStore((state) => state.language);
  const t = getLocale((language || 'en') as SupportedLocale);
  const { signInWithGitHub, signInWithGoogle, handleOAuthCallbackFromInput } = useAuthStore();
  const [manualInput, setManualInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinux, setIsLinux] = useState(false);

  useEffect(() => {
    try {
      setIsLinux(platform() === 'linux');
    } catch {
      setIsLinux(false);
    }
  }, []);

  const handleGitHubSignIn = async () => {
    await signInWithGitHub();
    onClose();
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
    onClose();
  };

  const handleUseOwnApiKey = () => {
    onClose();
    setActiveView(NavigationView.SETTINGS);
    // Dispatch event to switch to providers tab
    window.dispatchEvent(new CustomEvent('openModelSettingsTab'));
  };

  const handleCopyManualLink = async () => {
    const textToCopy = manualInput.trim();
    if (!textToCopy) {
      toast.error(t.Auth.errors.invalidCallback);
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(t.TalkCodyFreeDialog.manual.copySuccess);
    } catch {
      toast.error(t.TalkCodyFreeDialog.manual.copyFailed);
    }
  };

  const handleSubmitManual = async () => {
    if (!manualInput.trim()) {
      toast.error(t.Auth.errors.invalidCallback);
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await handleOAuthCallbackFromInput(manualInput);
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]" showCloseButton={false}>
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
              <Sparkles className="size-6 text-white" />
            </div>
            <DialogTitle className="text-xl font-semibold">
              {t.TalkCodyFreeDialog.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-left text-sm leading-relaxed text-muted-foreground">
            {t.TalkCodyFreeDialog.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="mt-0.5 size-5 shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <span className="flex size-full items-center justify-center text-xs font-medium text-amber-700 dark:text-amber-300">
                1
              </span>
            </div>
            <span>{t.TalkCodyFreeDialog.benefits.preventAbuse}</span>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="mt-0.5 size-5 shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <span className="flex size-full items-center justify-center text-xs font-medium text-amber-700 dark:text-amber-300">
                2
              </span>
            </div>
            <span>{t.TalkCodyFreeDialog.benefits.stableService}</span>
          </div>
        </div>

        <DialogFooter className="w-full gap-3 sm:flex-col">
          <Button
            className="w-full gap-2 bg-[#24292e] hover:bg-[#24292e]/90 dark:bg-[#f6f8fa] dark:text-[#24292e] dark:hover:bg-[#f6f8fa]/90"
            onClick={handleGitHubSignIn}
          >
            <Github className="size-4" />
            {t.TalkCodyFreeDialog.signInWithGitHub}
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={handleGoogleSignIn}>
            <SiGoogle size={16} />
            {t.TalkCodyFreeDialog.signInWithGoogle}
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={handleUseOwnApiKey}>
            <Settings className="size-4" />
            {t.TalkCodyFreeDialog.useOwnApiKey}
          </Button>

          {isLinux ? (
            <div className="w-full rounded-lg border border-dashed border-border/70 bg-muted/40 p-3 text-left text-sm">
              <p className="mb-2 font-medium text-foreground">
                {t.TalkCodyFreeDialog.manual.title}
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                {t.TalkCodyFreeDialog.manual.description}
              </p>
              <div className="flex flex-col gap-2">
                <Input
                  value={manualInput}
                  onChange={(event) => setManualInput(event.target.value)}
                  placeholder={t.TalkCodyFreeDialog.manual.placeholder}
                  className="font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyManualLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    {t.TalkCodyFreeDialog.manual.copyLink}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSubmitManual}
                    disabled={isSubmitting}
                  >
                    {t.TalkCodyFreeDialog.manual.submit}
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t.TalkCodyFreeDialog.manual.note}
              </p>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
