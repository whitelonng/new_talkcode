// src/components/settings/openai-oauth-login.tsx
// OAuth login component for OpenAI ChatGPT Plus/Pro authentication

import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { Check, Copy, ExternalLink, Loader2, LogOut, X } from 'lucide-react';
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
import { getRedirectUri } from '@/providers/oauth/openai-oauth-service';
import { useOpenAIOAuthStore } from '@/providers/oauth/openai-oauth-store';
import { useProviderStore } from '@/providers/stores/provider-store';

type FlowState = 'idle' | 'waiting-for-callback' | 'waiting-for-code' | 'exchanging' | 'connected';

const OPENAI_OAUTH_DISCLAIMER_KEY = 'openai-oauth-disclaimer-agreed';

export function OpenAIOAuthLogin() {
  const { t } = useLocale();
  const authCodeId = useId();
  const disclaimerCheckboxId = useId();
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [authInput, setAuthInput] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    isConnected,
    isLoading,
    error: storeError,
    initialize,
    startOAuthWithAutoCallback,
    completeOAuth,
    disconnect,
    cleanupCallbackListener,
  } = useOpenAIOAuthStore();

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
      // Auto-connected via callback server
      if (flowState === 'waiting-for-callback') {
        toast.success(t.Settings.openaiOAuth.connected);
        // Refresh provider store to pick up new OAuth credentials
        useProviderStore.getState().refresh();
      }
      setFlowState('connected');
    } else if (flowState === 'connected') {
      setFlowState('idle');
    }
  }, [isConnected, flowState, t]);

  // Perform the actual OAuth flow
  const performOAuth = useCallback(async () => {
    // Prevent starting a new OAuth flow if one is already in progress
    if (flowState === 'waiting-for-callback' || flowState === 'exchanging') {
      logger.warn('[OpenAIOAuthLogin] OAuth flow already in progress, ignoring duplicate request');
      return;
    }

    setError(null);
    setAuthInput('');
    setAuthUrl('');

    try {
      // Use auto callback flow - server will handle the callback automatically
      const url = await startOAuthWithAutoCallback();
      setAuthUrl(url);
      setFlowState('waiting-for-callback');

      // Open OAuth URL in system browser
      await shellOpen(url);
      logger.info('[OpenAIOAuthLogin] Opened OAuth URL in browser with auto callback');
    } catch (err) {
      logger.error('[OpenAIOAuthLogin] Failed to start OAuth:', err);
      const errorMessage = err instanceof Error ? err.message : '';

      // Check if it's a port-related error
      if (errorMessage.includes('port') || errorMessage.includes('Port')) {
        setError(t.Settings.openaiOAuth.connectionFailedWithPort);
      } else {
        setError(t.Settings.openaiOAuth.connectionFailed);
      }

      // Automatically switch to manual entry mode
      setFlowState('waiting-for-code');
    }
  }, [flowState, startOAuthWithAutoCallback, t]);

  // Handle starting OAuth flow with auto callback
  const handleStartOAuth = useCallback(async () => {
    // Check if user has already agreed to the disclaimer
    const hasAgreed = localStorage.getItem(OPENAI_OAUTH_DISCLAIMER_KEY) === 'true';

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
    localStorage.setItem(OPENAI_OAUTH_DISCLAIMER_KEY, 'true');
    setShowDisclaimer(false);

    // Proceed with OAuth
    await performOAuth();
  }, [disclaimerAgreed, performOAuth]);

  // Handle submitting authorization code/URL
  const handleSubmitCode = useCallback(async () => {
    if (!authInput.trim()) {
      setError(t.Settings.openaiOAuth.pasteCode);
      return;
    }

    setError(null);
    setFlowState('exchanging');

    try {
      await completeOAuth(authInput.trim());

      // Refresh provider store to pick up new OAuth credentials
      await useProviderStore.getState().refresh();

      toast.success(t.Settings.openaiOAuth.connected);
      setAuthInput('');
      setAuthUrl('');
      setFlowState('connected');
    } catch (err) {
      logger.error('[OpenAIOAuthLogin] Failed to complete OAuth:', err);
      setError(err instanceof Error ? err.message : t.Settings.openaiOAuth.connectionFailed);
      setFlowState('waiting-for-code');
    }
  }, [authInput, completeOAuth, t]);

  // Handle disconnecting
  const handleDisconnect = useCallback(async () => {
    setError(null);

    try {
      await disconnect();

      // Refresh provider store to remove OAuth credentials
      await useProviderStore.getState().refresh();

      toast.success(t.Settings.openaiOAuth.disconnected);
      setFlowState('idle');
    } catch (err) {
      logger.error('[OpenAIOAuthLogin] Failed to disconnect:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, [disconnect, t]);

  // Handle cancel during code entry
  const handleCancel = useCallback(() => {
    cleanupCallbackListener();
    setFlowState('idle');
    setAuthInput('');
    setAuthUrl('');
    setError(null);
  }, [cleanupCallbackListener]);

  // Switch from waiting-for-callback to manual entry mode
  const handleSwitchToManual = useCallback(() => {
    cleanupCallbackListener();
    setFlowState('waiting-for-code');
  }, [cleanupCallbackListener]);

  // Copy auth URL to clipboard
  const handleCopyUrl = useCallback(async () => {
    if (!authUrl) return;
    try {
      await navigator.clipboard.writeText(authUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('[OpenAIOAuthLogin] Failed to copy URL:', err);
    }
  }, [authUrl]);

  // Connected state
  if (flowState === 'connected' || isConnected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-600 dark:text-green-400">
              {t.Settings.openaiOAuth.connectedWithPlan}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            {t.Settings.openaiOAuth.disconnect}
          </Button>
        </div>
        {(error || storeError) && <p className="text-sm text-red-500">{error || storeError}</p>}
      </div>
    );
  }

  // Waiting for automatic callback state
  if (flowState === 'waiting-for-callback') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Waiting for authorization...</p>
            <p className="text-xs text-muted-foreground">
              Complete the login in your browser. This page will update automatically.
            </p>
          </div>
        </div>

        {/* Manual entry fallback */}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Manual code entry (if automatic redirect fails)
          </summary>
          <div className="mt-3 space-y-2">
            <Button variant="outline" size="sm" onClick={handleSwitchToManual}>
              Switch to manual entry
            </Button>
          </div>
        </details>

        <Button variant="ghost" size="sm" onClick={handleCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>

        {(error || storeError) && <p className="text-sm text-red-500">{error || storeError}</p>}
      </div>
    );
  }

  // Waiting for manual code state
  if (flowState === 'waiting-for-code' || flowState === 'exchanging') {
    return (
      <div className="space-y-4">
        {/* Step 1: Authorization URL */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t.Settings.openaiOAuth.step1}</Label>
          <div className="flex gap-2">
            <Input
              value={authUrl}
              readOnly
              className="text-xs font-mono"
              placeholder="Authorization URL..."
            />
            <Button variant="outline" size="icon" onClick={handleCopyUrl} title="Copy URL">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => shellOpen(authUrl)} title="Open">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t.Settings.openaiOAuth.step1Hint}</p>
        </div>

        {/* Step 2: Paste callback URL */}
        <div className="space-y-2">
          <Label htmlFor={authCodeId} className="text-sm font-medium">
            {t.Settings.openaiOAuth.step2}
          </Label>
          <div className="flex gap-2">
            <Input
              id={authCodeId}
              type="text"
              placeholder={t.Settings.openaiOAuth.codePlaceholder}
              value={authInput}
              onChange={(e) => setAuthInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmitCode();
                }
              }}
              disabled={flowState === 'exchanging'}
              className="font-mono text-sm"
            />
            <Button
              onClick={handleSubmitCode}
              disabled={flowState === 'exchanging' || !authInput.trim()}
            >
              {flowState === 'exchanging' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t.Settings.openaiOAuth.connect}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              disabled={flowState === 'exchanging'}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t.Settings.openaiOAuth.step2Hint}</p>
        </div>

        {/* Redirect URI hint */}
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{t.Settings.openaiOAuth.redirectUriNote}</span>{' '}
            <code className="rounded bg-background px-1 py-0.5">{getRedirectUri()}</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.Settings.openaiOAuth.redirectUriHint}
          </p>
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
            <p className="text-sm font-medium">{t.Settings.openaiOAuth.title}</p>
            <p className="text-xs text-muted-foreground">{t.Settings.openaiOAuth.description}</p>
          </div>
          <Button onClick={handleStartOAuth} disabled={isLoading || flowState !== 'idle'}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            {t.Settings.openaiOAuth.signIn}
          </Button>
        </div>

        {(error || storeError) && <p className="text-sm text-red-500">{error || storeError}</p>}
      </div>

      {/* Disclaimer Dialog */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.Settings.openaiOAuth.disclaimer.dialogTitle}</DialogTitle>
            <DialogDescription>
              {t.Settings.openaiOAuth.disclaimer.dialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-4 text-sm space-y-3">
              <p>
                Please read the{' '}
                <a
                  href={t.Settings.openaiOAuth.disclaimer.termsLink}
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
                onCheckedChange={(checked) => setDisclaimerAgreed(checked === true)}
              />
              <label
                htmlFor={disclaimerCheckboxId}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t.Settings.openaiOAuth.disclaimer.checkboxLabel}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisclaimer(false)}>
              {t.Settings.openaiOAuth.disclaimer.cancelButton}
            </Button>
            <Button onClick={handleDisclaimerConfirm} disabled={!disclaimerAgreed}>
              {t.Settings.openaiOAuth.disclaimer.confirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
