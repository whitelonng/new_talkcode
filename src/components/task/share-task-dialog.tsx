// src/components/task/share-task-dialog.tsx
// Dialog for sharing a task conversation

import type { ShareOptions } from '@talkcody/shared/types/share';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { Check, Copy, ExternalLink, Link2, Lock, Share2 } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import { shareService } from '@/services/share-service';
import type { Task, UIMessage } from '@/types';

interface ShareTaskDialogProps {
  task: Task;
  messages: UIMessage[];
  trigger?: React.ReactNode;
}

type ExpiresIn = '1d' | '7d' | '30d' | 'never';

export function ShareTaskDialog({ task, messages, trigger }: ShareTaskDialogProps) {
  const t = useTranslation();
  const passwordSwitchId = useId();
  const [open, setOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Share options
  const [expiresIn, setExpiresIn] = useState<ExpiresIn>('7d');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');

  const handleShare = async () => {
    logger.info('[ShareTaskDialog] handleShare called');
    logger.info('[ShareTaskDialog] messages.length:', messages.length);
    logger.info('[ShareTaskDialog] task:', task?.id, task?.title);

    if (messages.length === 0) {
      logger.info('[ShareTaskDialog] No messages to share');
      toast.error(t.Share?.emptyTask || 'No messages to share');
      return;
    }

    setIsSharing(true);
    try {
      const options: ShareOptions = {
        expiresIn,
      };

      if (usePassword && password) {
        options.password = password;
      }

      logger.info('[ShareTaskDialog] Calling shareService.shareTask...');
      const result = await shareService.shareTask(task, messages, options);
      logger.info('[ShareTaskDialog] Share result:', result);
      setShareUrl(result.shareUrl);
      toast.success(t.Share?.created || 'Share link created');
    } catch (error) {
      logger.error('[ShareTaskDialog] Failed to share task:', error);
      toast.error(t.Share?.failed || 'Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t.Common.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.Share?.copyFailed || 'Failed to copy link');
    }
  };

  const handleOpenInBrowser = async () => {
    if (shareUrl) {
      await shellOpen(shareUrl);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    logger.info('[ShareTaskDialog] handleOpenChange called, newOpen:', newOpen);
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setShareUrl(null);
      setCopied(false);
      setPassword('');
    }
  };

  const messageCount = messages.filter(
    (m) =>
      m.role !== 'system' &&
      (typeof m.content === 'string' ? m.content.trim() : m.content.length > 0)
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t.Share?.title || 'Share Task'}
          </DialogTitle>
          <DialogDescription>
            {t.Share?.description || 'Create a shareable link to this task.'}
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          // Share options form
          <div className="space-y-4 py-4">
            {/* Task info */}
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="font-medium">{task.title}</div>
              <div className="text-sm text-muted-foreground">
                {messageCount} {t.Share?.messages || 'messages'}
              </div>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label>{t.Share?.expiresIn || 'Expires in'}</Label>
              <Select value={expiresIn} onValueChange={(v) => setExpiresIn(v as ExpiresIn)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">{t.Share?.expires1d || '1 day'}</SelectItem>
                  <SelectItem value="7d">{t.Share?.expires7d || '7 days'}</SelectItem>
                  <SelectItem value="30d">{t.Share?.expires30d || '30 days'}</SelectItem>
                  <SelectItem value="never">{t.Share?.expiresNever || 'Never'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Password protection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="use-password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {t.Share?.passwordProtection || 'Password protection'}
                </Label>
                <Switch
                  id={passwordSwitchId}
                  checked={usePassword}
                  onCheckedChange={setUsePassword}
                />
              </div>
              {usePassword && (
                <Input
                  type="password"
                  placeholder={t.Share?.passwordPlaceholder || 'Enter password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </div>

            {/* Privacy notice */}
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
              <p>
                {t.Share?.privacyNotice ||
                  'File paths and sensitive data will be automatically sanitized.'}
              </p>
            </div>
          </div>
        ) : (
          // Share URL result
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopy} className="flex-shrink-0">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleCopy}>
                <Link2 className="mr-2 h-4 w-4" />
                {t.Share?.copyLink || 'Copy Link'}
              </Button>
              <Button variant="outline" onClick={handleOpenInBrowser}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t.Share?.openInBrowser || 'Open in Browser'}
              </Button>
            </div>

            {usePassword && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                <Lock className="mb-1 inline h-4 w-4" />{' '}
                {t.Share?.passwordSet || 'This share is password protected.'}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!shareUrl ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t.Common.cancel}
              </Button>
              <Button onClick={handleShare} disabled={isSharing}>
                {isSharing ? (
                  t.Common.loading
                ) : (
                  <>
                    <Share2 className="mr-2 h-4 w-4" />
                    {t.Share?.createLink || 'Create Link'}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleOpenChange(false)}>{t.Common.done}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
