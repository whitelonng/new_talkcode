import { Bot } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLocale } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import { remoteControlLifecycleService } from '@/services/remote/remote-control-lifecycle-service';
import { settingsManager } from '@/stores/settings-store';

const DEFAULT_POLL_TIMEOUT = '25';

const REMOTE_SECTION_CARD_STYLE = 'border-muted/60';

export interface RemoteControlSettingsState {
  enabled: boolean;
  token: string;
  allowedChats: string;
  pollTimeout: string;
  keepAwake: boolean;
}

/**
 * Convert a settings value to boolean safely
 * Handles both string 'true'/'false' and actual boolean values
 */
function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return false;
}

/**
 * Convert a settings value to string safely
 * Handles undefined/null values
 */
function valueToString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

export function RemoteControlSettings() {
  const { t } = useLocale();
  const tokenId = useId();
  const allowedChatsId = useId();
  const pollTimeoutId = useId();
  const feishuAppId = useId();
  const feishuAppSecret = useId();
  const feishuEncryptKey = useId();
  const feishuVerificationToken = useId();
  const feishuAllowedOpenIds = useId();
  const [remoteEnabled, setRemoteEnabled] = useState(
    toBoolean(settingsManager.get('telegram_remote_enabled'))
  );
  const [remoteToken, setRemoteToken] = useState(
    valueToString(settingsManager.get('telegram_remote_token'))
  );
  const [allowedChats, setAllowedChats] = useState(
    valueToString(settingsManager.get('telegram_remote_allowed_chats'))
  );
  const [pollTimeout, setPollTimeout] = useState(
    valueToString(settingsManager.get('telegram_remote_poll_timeout')) || DEFAULT_POLL_TIMEOUT
  );
  const [feishuEnabled, setFeishuEnabled] = useState(
    toBoolean(settingsManager.get('feishu_remote_enabled'))
  );
  const [feishuAppIdValue, setFeishuAppIdValue] = useState(
    valueToString(settingsManager.get('feishu_remote_app_id'))
  );
  const [feishuAppSecretValue, setFeishuAppSecretValue] = useState(
    valueToString(settingsManager.get('feishu_remote_app_secret'))
  );
  const [feishuEncryptKeyValue, setFeishuEncryptKeyValue] = useState(
    valueToString(settingsManager.get('feishu_remote_encrypt_key'))
  );
  const [feishuVerificationTokenValue, setFeishuVerificationTokenValue] = useState(
    valueToString(settingsManager.get('feishu_remote_verification_token'))
  );
  const [feishuAllowedOpenIdsValue, setFeishuAllowedOpenIdsValue] = useState(
    valueToString(settingsManager.get('feishu_remote_allowed_open_ids'))
  );
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(
    toBoolean(settingsManager.get('remote_control_keep_awake'))
  );

  const hasAnyRemoteEnabled = useMemo(
    () => remoteEnabled || feishuEnabled,
    [remoteEnabled, feishuEnabled]
  );

  const validateRemoteSettings = () => {
    if (!remoteEnabled) {
      return null;
    }
    if (!remoteToken.trim()) {
      return t.Settings.remoteControl.errors.tokenMissing;
    }
    const timeoutValue = Number(pollTimeout);
    if (!Number.isFinite(timeoutValue) || timeoutValue < 5 || timeoutValue > 60) {
      return t.Settings.remoteControl.errors.pollTimeoutRange;
    }
    return null;
  };

  const validateFeishuSettings = () => {
    if (!feishuEnabled) {
      return null;
    }
    if (!feishuAppIdValue.trim()) {
      return t.Settings.remoteControl.feishu.errors.appIdMissing;
    }
    if (!feishuAppSecretValue.trim()) {
      return t.Settings.remoteControl.feishu.errors.appSecretMissing;
    }
    return null;
  };

  const handleRemoteSave = async () => {
    const validationError = validateRemoteSettings() ?? validateFeishuSettings();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await settingsManager.initialize();
      await settingsManager.setTelegramRemoteEnabled(remoteEnabled);
      await settingsManager.set('telegram_remote_token', remoteToken.trim());
      await settingsManager.set('telegram_remote_allowed_chats', allowedChats.trim());
      await settingsManager.set(
        'telegram_remote_poll_timeout',
        pollTimeout || DEFAULT_POLL_TIMEOUT
      );
      await settingsManager.setFeishuRemoteEnabled(feishuEnabled);
      await settingsManager.setFeishuRemoteAppId(feishuAppIdValue.trim());
      await settingsManager.setFeishuRemoteAppSecret(feishuAppSecretValue.trim());
      await settingsManager.setFeishuRemoteEncryptKey(feishuEncryptKeyValue.trim());
      await settingsManager.setFeishuRemoteVerificationToken(feishuVerificationTokenValue.trim());
      await settingsManager.setFeishuRemoteAllowedOpenIds(feishuAllowedOpenIdsValue.trim());
      await settingsManager.set('remote_control_keep_awake', keepAwakeEnabled.toString());
      await remoteControlLifecycleService.refresh();
      toast.success(t.Settings.remoteControl.saved);
    } catch (error) {
      logger.error('[RemoteControlSettings] Failed to save remote control settings:', error);
      toast.error(t.Settings.remoteControl.saveFailed);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={REMOTE_SECTION_CARD_STYLE}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle className="text-lg">{t.Settings.remoteControl.title}</CardTitle>
          </div>
          <CardDescription>{t.Settings.remoteControl.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">{t.Settings.remoteControl.enabled}</Label>
            </div>
            <Switch checked={remoteEnabled} onCheckedChange={setRemoteEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={tokenId}>{t.Settings.remoteControl.tokenLabel}</Label>
            <Input
              id={tokenId}
              type="password"
              placeholder={t.Settings.remoteControl.tokenPlaceholder}
              value={remoteToken}
              onChange={(event) => setRemoteToken(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={allowedChatsId}>{t.Settings.remoteControl.allowedChatsLabel}</Label>
            <Input
              id={allowedChatsId}
              placeholder={t.Settings.remoteControl.allowedChatsPlaceholder}
              value={allowedChats}
              onChange={(event) => setAllowedChats(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={pollTimeoutId}>{t.Settings.remoteControl.pollTimeoutLabel}</Label>
            <Input
              id={pollTimeoutId}
              placeholder={t.Settings.remoteControl.pollTimeoutPlaceholder}
              value={pollTimeout}
              onChange={(event) => setPollTimeout(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t.Settings.remoteControl.pollTimeoutHint}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className={REMOTE_SECTION_CARD_STYLE}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle className="text-lg">{t.Settings.remoteControl.feishu.title}</CardTitle>
          </div>
          <CardDescription>{t.Settings.remoteControl.feishu.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">
                {t.Settings.remoteControl.feishu.enabled}
              </Label>
            </div>
            <Switch checked={feishuEnabled} onCheckedChange={setFeishuEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={feishuAppId}>{t.Settings.remoteControl.feishu.appIdLabel}</Label>
            <Input
              id={feishuAppId}
              placeholder={t.Settings.remoteControl.feishu.appIdPlaceholder}
              value={feishuAppIdValue}
              onChange={(event) => setFeishuAppIdValue(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={feishuAppSecret}>
              {t.Settings.remoteControl.feishu.appSecretLabel}
            </Label>
            <Input
              id={feishuAppSecret}
              type="password"
              placeholder={t.Settings.remoteControl.feishu.appSecretPlaceholder}
              value={feishuAppSecretValue}
              onChange={(event) => setFeishuAppSecretValue(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={feishuEncryptKey}>
              {t.Settings.remoteControl.feishu.encryptKeyLabel}
            </Label>
            <Input
              id={feishuEncryptKey}
              type="password"
              placeholder={t.Settings.remoteControl.feishu.encryptKeyPlaceholder}
              value={feishuEncryptKeyValue}
              onChange={(event) => setFeishuEncryptKeyValue(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={feishuVerificationToken}>
              {t.Settings.remoteControl.feishu.verificationTokenLabel}
            </Label>
            <Input
              id={feishuVerificationToken}
              type="password"
              placeholder={t.Settings.remoteControl.feishu.verificationTokenPlaceholder}
              value={feishuVerificationTokenValue}
              onChange={(event) => setFeishuVerificationTokenValue(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={feishuAllowedOpenIds}>
              {t.Settings.remoteControl.feishu.allowedOpenIdsLabel}
            </Label>
            <Input
              id={feishuAllowedOpenIds}
              placeholder={t.Settings.remoteControl.feishu.allowedOpenIdsPlaceholder}
              value={feishuAllowedOpenIdsValue}
              onChange={(event) => setFeishuAllowedOpenIdsValue(event.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t.Settings.remoteControl.feishu.allowlistHint}
          </p>
        </CardContent>
      </Card>

      <Card className={REMOTE_SECTION_CARD_STYLE}>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">
                {t.Settings.remoteControl.keepAwakeLabel}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t.Settings.remoteControl.keepAwakeHint}
              </p>
            </div>
            <Switch checked={keepAwakeEnabled} onCheckedChange={setKeepAwakeEnabled} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground">
              {hasAnyRemoteEnabled
                ? t.Settings.remoteControl.statusEnabled
                : t.Settings.remoteControl.statusDisabled}
            </div>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={handleRemoteSave}
            >
              {t.Settings.remoteControl.save}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
