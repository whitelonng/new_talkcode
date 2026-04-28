import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CodeXml, Globe, MonitorUp, MousePointerClick, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { logger } from '@/lib/logger';
import { simpleFetch } from '@/lib/tauri-fetch';

interface BrowserPanelProps {
  sourceType: 'none' | 'url' | 'file';
  currentUrl: string;
  currentFilePath: string | null;
  currentContent: string | null;
  onOpenUrl: (url: string) => void;
  onClose?: () => void;
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return false;
  }
}

function isHtmlLikeFile(filePath: string | null): boolean {
  if (!filePath) return false;
  return /\.(html?|svg)$/i.test(filePath);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export function BrowserPanel({
  sourceType,
  currentUrl,
  currentFilePath,
  currentContent,
  onOpenUrl,
  onClose,
}: BrowserPanelProps) {
  const t = useTranslation();
  const [urlInput, setUrlInput] = useState(currentUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isPickerMode, setIsPickerMode] = useState(false);
  const [nativeState, setNativeState] = useState<unknown>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const isEmbeddedMode = sourceType === 'url' || (sourceType === 'file' && isHtmlLikeFile(currentFilePath));

  useEffect(() => {
    setUrlInput(currentUrl || '');
  }, [currentUrl]);

  const fetchNativeState = useCallback(async () => {
    try {
      const state = await invoke('browser_control_get_state');
      setNativeState(state);
    } catch (error) {
      logger.warn('Failed to fetch native browser state:', error);
      setNativeState(null);
    }
  }, []);

  useEffect(() => {
    if (isEmbeddedMode) {
      setNativeState(null);
      return;
    }
    void fetchNativeState();
  }, [fetchNativeState, isEmbeddedMode]);

  useEffect(() => {
    const unlistenPromise = listen('browser-bridge-status', () => {
      // Keep listener attached for compatibility with existing browser bridge events.
    }).catch((error) => {
      logger.warn('Failed to attach browser bridge listener:', error);
      return null;
    });

    return () => {
      void unlistenPromise.then((unlisten) => {
        unlisten?.();
      });
    };
  }, []);

  const openNormalizedUrl = useCallback(async () => {
    const normalized = normalizeUrl(urlInput);
    if (!normalized) return;
    setIsLoading(true);
    try {
      onOpenUrl(normalized);
      if (isLocalhostUrl(normalized)) {
        try {
          await simpleFetch(normalized, { method: 'HEAD' });
        } catch (error) {
          logger.warn('Localhost probe failed:', error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [onOpenUrl, urlInput]);

  const togglePickerMode = useCallback(() => {
    setIsPickerMode((prev) => !prev);
    const nextEnabled = !isPickerMode;
    toast.info(nextEnabled ? 'Style picker enabled' : 'Style picker disabled');
  }, [isPickerMode]);

  const handleIframeLoad = useCallback(() => {
    if (!isPickerMode) return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    const attachPicker = () => {
      const onClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const snippet = escapeHtml(target.outerHTML).slice(0, 400);
        void navigator.clipboard
          .writeText(snippet)
          .then(() => toast.success('Style information copied to clipboard'))
          .catch((error) => {
            logger.warn('Failed to copy style information:', error);
            toast.error('Failed to copy style information');
          });
        setIsPickerMode(false);
      };

      doc.addEventListener('click', onClick, { capture: true, once: true });
    };

    attachPicker();
  }, [isPickerMode]);

  const statusBadge = useMemo(() => {
    const label = isEmbeddedMode ? 'embedded' : nativeState ? 'native' : 'idle';
    return <Badge variant="outline">{label}</Badge>;
  }, [isEmbeddedMode, nativeState]);

  return (
    <div className="flex h-full min-h-0 flex-col border-l bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.Common.close}</TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void openNormalizedUrl();
              }
            }}
            placeholder="Enter URL"
          />
        </div>

        <Button variant="outline" size="icon" onClick={() => void openNormalizedUrl()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>

        <Button variant={isPickerMode ? 'default' : 'outline'} size="icon" onClick={togglePickerMode}>
          <MousePointerClick className="h-4 w-4" />
        </Button>

        {statusBadge}
      </div>

      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
        <MonitorUp className="h-3.5 w-3.5" />
        <span>{sourceType}</span>
        {currentFilePath ? <span className="truncate">{currentFilePath}</span> : null}
        {nativeState ? <Badge variant="outline">native</Badge> : null}
      </div>

      <div className="relative min-h-0 flex-1">
        {isEmbeddedMode ? (
          <iframe
            ref={iframeRef}
            className="h-full w-full border-0"
            src={sourceType === 'url' ? currentUrl : undefined}
            srcDoc={sourceType === 'file' ? currentContent || '' : undefined}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
            title="browser-panel"
            onLoad={handleIframeLoad}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <CodeXml className="h-8 w-8" />
            <div>
              <p>Browser panel</p>
              <p className="text-xs">Native browser preview mode</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
