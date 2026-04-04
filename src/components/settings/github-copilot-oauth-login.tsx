// src/components/settings/github-copilot-oauth-login.tsx
// OAuth login component for GitHub Copilot authentication
// Uses Device Code Flow with frontend polling

import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { Check, Copy, ExternalLink, Loader2, LogOut, Play, RotateCw, X } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useLocale } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import { useGitHubCopilotOAuthStore } from '@/providers/oauth/github-copilot-oauth-store';
import { useProviderStore } from '@/providers/stores/provider-store';

type FlowState = 'idle' | 'polling' | 'connected';

const GITHUB_COPILOT_DISCLAIMER_KEY = 'github-copilot-oauth-disclaimer-agreed';

export function GitHubCopilotOAuthLogin() {
  const { t } = useLocale();
  const disclaimerCheckboxId = useId();
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    isConnected,
    isLoading,
    isPolling,
    error: storeError,
    userCode: storedUserCode,
    verificationUri: storedVerificationUri,
    initialize,
    startOAuth,
    pollForToken,
    disconnect,
  } = useGitHubCopilotOAuthStore();

  // Disclaimer dialog state
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(false);

  // Initialize OAuth store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Sync flow state with connection status
  useEffect(() => {
    if (isConnected) {
      toast.success(t.Settings.githubCopilotOAuth.connected);
      // Refresh provider store to pick up new OAuth credentials
      useProviderStore.getState().refresh();
      setFlowState('connected');
    }
  }, [isConnected, t]);

  // Sync with store state when OAuth is in progress
  useEffect(() => {
    if (storedUserCode && storedVerificationUri) {
      setUserCode(storedUserCode);
      setVerificationUri(storedVerificationUri);
    }
  }, [storedUserCode, storedVerificationUri]);

  // Perform the actual OAuth flow and start polling
  const performOAuth = useCallback(async () => {
    setError(null);

    try {
      // Start OAuth flow
      const result = await startOAuth();
      setUserCode(result.userCode);
      setVerificationUri(result.verificationUri);
      setFlowState('polling');

      // Open verification URI in system browser
      await shellOpen(result.verificationUri);
      logger.info('[GitHubCopilotOAuthLogin] Opened verification URI in browser');

      // Start polling for token
      await pollForToken();
      logger.info('[GitHubCopilotOAuthLogin] OAuth completed successfully');
    } catch (err) {
      logger.error('[GitHubCopilotOAuthLogin] OAuth failed:', err);
      setError(err instanceof Error ? err.message : t.Settings.githubCopilotOAuth.connectionFailed);
      setFlowState('idle');
    }
  }, [startOAuth, pollForToken, t]);

  // Handle starting OAuth flow
  const handleStartOAuth = useCallback(async () => {
    // Check if user has already agreed to the disclaimer
    const hasAgreed = localStorage.getItem(GITHUB_COPILOT_DISCLAIMER_KEY) === 'true';

    if (hasAgreed) {
      // User has agreed, proceed with OAuth
      await performOAuth();
    } else {
      // Show disclaimer dialog
      setShowDisclaimer(true);
      setDisclaimerAgreed(false);
    }
  }, [performOAuth]);

  // Handle disclaimer confirmation
  const handleDisclaimerConfirm = useCallback(async () => {
    if (!disclaimerAgreed) return;

    // Save agreement to localStorage
    localStorage.setItem(GITHUB_COPILOT_DISCLAIMER_KEY, 'true');
    setShowDisclaimer(false);

    // Proceed with OAuth
    await performOAuth();
  }, [disclaimerAgreed, performOAuth]);

  // Handle manually starting polling (for users who closed the browser)
  const handleStartPolling = useCallback(async () => {
    if (!userCode.trim()) {
      setError(t.Settings.githubCopilotOAuth.pasteCode);
      return;
    }

    setError(null);

    try {
      await pollForToken();
      logger.info('[GitHubCopilotOAuthLogin] OAuth completed via manual polling');
    } catch (err) {
      logger.error('[GitHubCopilotOAuthLogin] Manual polling failed:', err);
      setError(err instanceof Error ? err.message : t.Settings.githubCopilotOAuth.connectionFailed);
    }
  }, [userCode, pollForToken, t]);

  // Handle disconnecting
  const handleDisconnect = useCallback(async () => {
    setError(null);

    try {
      await disconnect();

      // Refresh provider store to remove OAuth credentials
      await useProviderStore.getState().refresh();

      toast.success(t.Settings.githubCopilotOAuth.disconnected);
      setFlowState('idle');
      setUserCode('');
      setVerificationUri('');
    } catch (err) {
      logger.error('[GitHubCopilotOAuthLogin] Failed to disconnect:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, [disconnect, t]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setFlowState('idle');
    setUserCode('');
    setVerificationUri('');
    setError(null);
  }, []);

  // Connected state
  if (flowState === 'connected' || isConnected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-600 dark:text-green-400">
              {t.Settings.githubCopilotOAuth.connectedWithPlan}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            {t.Settings.githubCopilotOAuth.disconnect}
          </Button>
        </div>
        {(error || storeError) && <p className="text-sm text-red-500">{error || storeError}</p>}
      </div>
    );
  }

  // Polling state - waiting for user authorization
  if (flowState === 'polling') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {isPolling ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <RotateCw className="h-5 w-5 text-muted-foreground" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isPolling
                ? t.Settings.githubCopilotOAuth.waitingForAuth
                : t.Settings.githubCopilotOAuth.exchangingCode}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPolling
                ? 'Complete the login in your browser. Polling for token...'
                : t.Settings.githubCopilotOAuth.exchangingCodeHint}
            </p>
          </div>
        </div>

        {/* User code display */}
        {userCode && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{t.Settings.githubCopilotOAuth.userCode}:</span>{' '}
              <code className="rounded bg-background px-1 py-0.5 font-mono text-sm">
                {userCode}
              </code>
            </p>
          </div>
        )}

        {/* Manual polling trigger */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleStartPolling} disabled={isPolling}>
            {isPolling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {isPolling
              ? t.Settings.githubCopilotOAuth.waitingForAuth
              : t.Settings.githubCopilotOAuth.connect}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => shellOpen(verificationUri)}
            disabled={!verificationUri}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Re-open Link
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isPolling}>
            <X className="mr-2 h-4 w-4" />
            {t.Common.cancel}
          </Button>
        </div>

        {(error || storeError) && <p className="text-sm text-red-500">{error || storeError}</p>}
      </div>
    );
  }

  // Idle state - show sign in button
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t.Settings.githubCopilotOAuth.title}</p>
            <p className="text-xs text-muted-foreground">
              {t.Settings.githubCopilotOAuth.description}
            </p>
          </div>
          <Button onClick={handleStartOAuth} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            {t.Settings.githubCopilotOAuth.signIn}
          </Button>
        </div>

        {(error || storeError) && <p className="text-sm text-red-500">{error || storeError}</p>}
      </div>

      {/* Disclaimer Dialog */}
      {t.Settings.githubCopilotOAuth.disclaimer && (
        <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t.Settings.githubCopilotOAuth.disclaimer.dialogTitle}</DialogTitle>
              <DialogDescription>
                {t.Settings.githubCopilotOAuth.disclaimer.dialogDescription}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4 text-sm space-y-3">
                <p>
                  Please read the{' '}
                  <a
                    href={t.Settings.githubCopilotOAuth.disclaimer.termsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Terms of Use & Disclaimer
                  </a>{' '}
                  before proceeding.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={disclaimerCheckboxId}
                  checked={disclaimerAgreed}
                  onCheckedChange={(checked: boolean) => setDisclaimerAgreed(checked)}
                />
                <label
                  htmlFor={disclaimerCheckboxId}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {t.Settings.githubCopilotOAuth.disclaimer.checkboxLabel}
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDisclaimer(false)}>
                {t.Settings.githubCopilotOAuth.disclaimer.cancelButton}
              </Button>
              <Button onClick={handleDisclaimerConfirm} disabled={!disclaimerAgreed}>
                {t.Settings.githubCopilotOAuth.disclaimer.confirmButton}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
