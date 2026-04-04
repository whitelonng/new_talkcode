import { Globe, Loader2, MousePointerClick, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';

interface BrowserPanelProps {
  sourceType: 'none' | 'url' | 'file';
  currentUrl: string;
  currentFilePath: string | null;
  currentContent: string | null;
  onOpenUrl: (url: string) => void;
  onClose?: () => void;
}

type PickerMessage =
  | {
      type: 'talkcody-style-picked';
      payload: {
        summary: string;
        selector?: string;
        tag?: string;
      };
    }
  | {
      type: 'talkcody-picker-debug';
      payload: {
        status: 'ready' | 'active' | 'inactive' | 'hover' | 'picked' | 'error';
        selector?: string;
        tag?: string;
        note?: string;
      };
    };

function isHtmlLikeFile(filePath: string | null): boolean {
  if (!filePath) {
    return false;
  }

  return /\.(html?|svg)$/i.test(filePath);
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}

function buildPickerInjection(): string {
  return `
    <style>
      html[data-talkcody-picker='active'],
      html[data-talkcody-picker='active'] * {
        cursor: crosshair !important;
      }

      #talkcody-style-picker-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483647;
      }

      #talkcody-style-picker-highlight {
        position: fixed;
        border: 2px solid #3b82f6;
        background: rgba(59, 130, 246, 0.12);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85) inset;
        pointer-events: none;
        z-index: 2147483647;
        display: none;
      }
    </style>
    <script>
      (function () {
        var PICKER_ATTR = 'data-talkcody-picker';
        var highlight = null;
        var highlightedElement = null;

        function ensureOverlay() {
          if (!document.body) {
            return;
          }

          if (document.getElementById('talkcody-style-picker-overlay')) {
            highlight = document.getElementById('talkcody-style-picker-highlight');
            return;
          }

          var overlay = document.createElement('div');
          overlay.id = 'talkcody-style-picker-overlay';

          highlight = document.createElement('div');
          highlight.id = 'talkcody-style-picker-highlight';
          overlay.appendChild(highlight);
          document.body.appendChild(overlay);
        }

        function isPickerActive() {
          return document.documentElement.getAttribute(PICKER_ATTR) === 'active';
        }

        function clearHighlight() {
          highlightedElement = null;
          if (highlight) {
            highlight.style.display = 'none';
          }
        }

        function updateHighlight(element) {
          ensureOverlay();

          if (!highlight || !(element instanceof Element)) {
            clearHighlight();
            return;
          }

          if (
            element.id === 'talkcody-style-picker-overlay' ||
            element.id === 'talkcody-style-picker-highlight'
          ) {
            return;
          }

          var rect = element.getBoundingClientRect();
          if (rect.width <= 0 && rect.height <= 0) {
            clearHighlight();
            return;
          }

          highlightedElement = element;
          highlight.style.display = 'block';
          highlight.style.left = rect.left + 'px';
          highlight.style.top = rect.top + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';

          window.parent.postMessage(
            {
              type: 'talkcody-picker-debug',
              payload: {
                status: 'hover',
                selector: getSelector(element),
                tag: element.tagName.toLowerCase(),
                note: 'Hover target updated',
              },
            },
            '*'
          );
        }

        function getTargetElement(event) {
          var pointTarget = document.elementFromPoint(event.clientX, event.clientY);
          if (pointTarget instanceof Element) {
            if (
              pointTarget.id === 'talkcody-style-picker-overlay' ||
              pointTarget.id === 'talkcody-style-picker-highlight'
            ) {
              return highlightedElement;
            }

            return pointTarget;
          }

          if (event.target instanceof Element) {
            return event.target;
          }

          if (event.target && event.target.parentElement) {
            return event.target.parentElement;
          }

          return null;
        }

        function getSelector(element) {
          if (!element || !element.tagName) {
            return '';
          }

          if (element.id) {
            return '#' + element.id;
          }

          var parts = [];
          var current = element;
          var depth = 0;

          while (current && current.nodeType === Node.ELEMENT_NODE && depth < 4) {
            var part = current.tagName.toLowerCase();
            var classNames = Array.from(current.classList || []).filter(Boolean).slice(0, 2);
            if (classNames.length > 0) {
              part += '.' + classNames.join('.');
            }

            var parent = current.parentElement;
            if (parent) {
              var siblings = Array.from(parent.children).filter(function (child) {
                return child.tagName === current.tagName;
              });
              if (siblings.length > 1) {
                part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
              }
            }

            parts.unshift(part);
            current = current.parentElement;
            depth += 1;
          }

          return parts.join(' > ');
        }

        function collectStyles(element) {
          var computed = window.getComputedStyle(element);
          var importantStyles = {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            lineHeight: computed.lineHeight,
            display: computed.display,
            position: computed.position,
            margin: computed.margin,
            padding: computed.padding,
            border: computed.border,
            borderRadius: computed.borderRadius,
            width: computed.width,
            height: computed.height,
            boxShadow: computed.boxShadow,
            opacity: computed.opacity,
          };

          return Object.entries(importantStyles)
            .map(function (_ref) {
              var key = _ref[0];
              var val = _ref[1];
              return '- ' + key + ': ' + val;
            })
            .join('\n');
        }

        function createSummary(element) {
          var text = (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
          var classNames = Array.from(element.classList || []).filter(Boolean).join(' ');
          var inlineStyle = element.getAttribute('style') || '';
          var selector = getSelector(element);

          return {
            selector: selector,
            summary: [
              'Please help me precisely update this element style:',
              '',
              'selector: ' + selector,
              'tag: ' + element.tagName.toLowerCase(),
              'classes: ' + (classNames || '(none)'),
              'text: ' + (text || '(empty)'),
              'inline style: ' + (inlineStyle || '(none)'),
              'computed styles:',
              collectStyles(element),
            ].join('\n'),
          };
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
        } else {
          ensureOverlay();
        }

        window.parent.postMessage(
          {
            type: 'talkcody-picker-debug',
            payload: {
              status: 'ready',
              note: 'Picker script injected',
            },
          },
          '*'
        );

        document.addEventListener(
          'mousemove',
          function (event) {
            if (!isPickerActive()) {
              return;
            }

            updateHighlight(getTargetElement(event));
          },
          true
        );

        window.addEventListener(
          'scroll',
          function () {
            if (!isPickerActive() || !highlightedElement) {
              return;
            }

            updateHighlight(highlightedElement);
          },
          true
        );

        document.addEventListener(
          'click',
          function (event) {
            if (!isPickerActive()) {
              return;
            }

            var element = getTargetElement(event);
            if (!(element instanceof Element)) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
              event.stopImmediatePropagation();
            }

            var summary = createSummary(element);
            clearHighlight();
            document.documentElement.setAttribute(PICKER_ATTR, 'inactive');

            window.parent.postMessage(
              {
                type: 'talkcody-picker-debug',
                payload: {
                  status: 'picked',
                  selector: summary.selector,
                  tag: element.tagName.toLowerCase(),
                  note: 'Element clicked and payload generated',
                },
              },
              '*'
            );

            window.parent.postMessage(
              {
                type: 'talkcody-style-picked',
                payload: {
                  summary: summary.summary,
                  selector: summary.selector,
                  tag: element.tagName.toLowerCase(),
                },
              },
              '*'
            );
          },
          true
        );

        window.addEventListener('message', function (event) {
          if (!event.data || typeof event.data !== 'object') {
            return;
          }

          if (event.data.type === 'talkcody-picker-toggle') {
            document.documentElement.setAttribute(
              PICKER_ATTR,
              event.data.payload && event.data.payload.active ? 'active' : 'inactive'
            );

            window.parent.postMessage(
              {
                type: 'talkcody-picker-debug',
                payload: {
                  status: event.data.payload && event.data.payload.active ? 'active' : 'inactive',
                  note: event.data.payload && event.data.payload.active
                    ? 'Picker activated in preview'
                    : 'Picker deactivated in preview',
                },
              },
              '*'
            );

            if (!(event.data.payload && event.data.payload.active)) {
              clearHighlight();
            }
          }
        });
      })();
    </script>
  `;
}

function buildHtmlDocument(rawHtml: string, baseUrl?: string): string {
  const pickerInjection = buildPickerInjection();
  const baseTag = baseUrl ? `<base href="${escapeHtml(baseUrl)}" />` : '';
  const headInjection = `
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${baseTag}
    <style>
      :root { color-scheme: light dark; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        line-height: 1.5;
        background: #ffffff;
        color: #0f172a;
      }
      @media (prefers-color-scheme: dark) {
        body { background: #0b0f1a; color: #e2e8f0; }
      }
      img, video { max-width: 100%; height: auto; }
    </style>
    ${pickerInjection}
  `;

  if (/<!doctype\s+html>/i.test(rawHtml) || /<html\b/i.test(rawHtml)) {
    let html = rawHtml;

    if (/<head\b/i.test(html)) {
      html = html.replace(/<head\b[^>]*>/i, (match) => `${match}${headInjection}`);
    } else {
      html = html.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${headInjection}</head>`);
    }

    if (/<html\b/i.test(html)) {
      return html.replace(
        /<html\b([^>]*)>/i,
        `<html$1 data-talkcody-picker="inactive">`
      );
    }

    return html;
  }

  return `<!doctype html>
<html data-talkcody-picker="inactive">
  <head>
    ${headInjection}
  </head>
  <body>
    ${rawHtml}
  </body>
</html>`;
}

function buildTextPreviewDocument(currentContent: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        padding: 16px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space: pre-wrap;
        background: #0b0f1a;
        color: #e2e8f0;
      }
      pre { margin: 0; }
    </style>
  </head>
  <body>
    <pre>${escapeHtml(currentContent)}</pre>
  </body>
</html>`;
}

function buildFilePreviewDocument(
  currentContent: string | null,
  currentFilePath: string | null
): string | null {
  if (!currentFilePath || !currentContent) {
    return null;
  }

  if (isHtmlLikeFile(currentFilePath)) {
    return buildHtmlDocument(currentContent);
  }

  return buildTextPreviewDocument(currentContent);
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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const isPickerActiveRef = useRef(false);
  const [addressInput, setAddressInput] = useState(currentUrl);
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [pickerDebugStatus, setPickerDebugStatus] = useState<
    'idle' | 'ready' | 'active' | 'inactive' | 'hover' | 'picked' | 'error'
  >('idle');
  const [pickerDebugSelector, setPickerDebugSelector] = useState('');
  const [pickerDebugTag, setPickerDebugTag] = useState('');
  const [pickerDebugNote, setPickerDebugNote] = useState('');
  const [pickerLastSummary, setPickerLastSummary] = useState('');
  const [localhostPreviewHtml, setLocalhostPreviewHtml] = useState<string | null>(null);
  const [isLoadingLocalhostPreview, setIsLoadingLocalhostPreview] = useState(false);
  const [localhostPreviewFailed, setLocalhostPreviewFailed] = useState(false);

  useEffect(() => {
    setAddressInput(currentUrl);
  }, [currentUrl]);

  useEffect(() => {
    isPickerActiveRef.current = isPickerActive;
  }, [isPickerActive]);

  const postPickerToggle = useCallback((active: boolean) => {
    const contentWindow = iframeRef.current?.contentWindow;
    if (!contentWindow) {
      return false;
    }

    contentWindow.postMessage(
      {
        type: 'talkcody-picker-toggle',
        payload: { active },
      },
      '*'
    );

    return true;
  }, []);

  useEffect(() => {
    if (!isPickerActive) {
      return;
    }

    const timer = window.setInterval(() => {
      postPickerToggle(true);
    }, 250);

    return () => window.clearInterval(timer);
  }, [isPickerActive, postPickerToggle]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent<PickerMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (event.data?.type === 'talkcody-picker-debug') {
        setPickerDebugStatus(event.data.payload.status);
        setPickerDebugSelector(event.data.payload.selector || '');
        setPickerDebugTag(event.data.payload.tag || '');
        setPickerDebugNote(event.data.payload.note || '');
        return;
      }

      if (event.data?.type !== 'talkcody-style-picked') {
        return;
      }

      setIsPickerActive(false);
      setPickerDebugStatus('picked');
      setPickerDebugSelector(event.data.payload.selector || '');
      setPickerDebugTag(event.data.payload.tag || '');
      setPickerDebugNote('Style captured and copying to clipboard');
      setPickerLastSummary(event.data.payload.summary);

      try {
        await navigator.clipboard.writeText(event.data.payload.summary);
        toast.success(t.RepositoryLayout.stylePickerCopied);
      } catch {
        setPickerDebugStatus('error');
        setPickerDebugNote('Clipboard write failed');
        toast.error(t.RepositoryLayout.stylePickerCopyFailed);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [t]);

  useEffect(() => {
    if (sourceType === 'file') {
      return;
    }

    if (sourceType === 'url' && isLocalhostUrl(currentUrl)) {
      return;
    }

    isPickerActiveRef.current = false;
    setIsPickerActive(false);
    setPickerDebugStatus('idle');
    setPickerDebugSelector('');
    setPickerDebugTag('');
    setPickerDebugNote('');
  }, [sourceType, currentFilePath, currentUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadLocalhostPreview = async () => {
      if (sourceType !== 'url' || !currentUrl || !isLocalhostUrl(currentUrl)) {
        setLocalhostPreviewHtml(null);
        setLocalhostPreviewFailed(false);
        setIsLoadingLocalhostPreview(false);
        return;
      }

      setIsLoadingLocalhostPreview(true);
      setLocalhostPreviewFailed(false);

      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        if (!cancelled) {
          setLocalhostPreviewHtml(html);
          setLocalhostPreviewFailed(false);
        }
      } catch {
        if (!cancelled) {
          setLocalhostPreviewHtml(null);
          setLocalhostPreviewFailed(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLocalhostPreview(false);
        }
      }
    };

    void loadLocalhostPreview();

    return () => {
      cancelled = true;
    };
  }, [sourceType, currentUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      postPickerToggle(isPickerActive);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isPickerActive, localhostPreviewHtml, currentFilePath, currentContent, postPickerToggle]);

  const isLocalhostPreview = sourceType === 'url' && !!currentUrl && isLocalhostUrl(currentUrl);
  const canUsePicker =
    (sourceType === 'file' && isHtmlLikeFile(currentFilePath) && !!currentContent) ||
    (isLocalhostPreview && !!localhostPreviewHtml);

  const filePreviewDocument = useMemo(
    () => buildFilePreviewDocument(currentContent, currentFilePath),
    [currentContent, currentFilePath]
  );

  const localhostPreviewDocument = useMemo(() => {
    if (!isLocalhostPreview || !localhostPreviewHtml) {
      return null;
    }

    return buildHtmlDocument(localhostPreviewHtml, currentUrl);
  }, [currentUrl, isLocalhostPreview, localhostPreviewHtml]);

  const sourceLabel = currentFilePath || currentUrl || t.RepositoryLayout.browserEmptyState;

  const handleSubmit = () => {
    const normalizedUrl = normalizeUrl(addressInput);
    if (!normalizedUrl) {
      return;
    }
    onOpenUrl(normalizedUrl);
  };

  const handleTogglePicker = () => {
    if (!canUsePicker) {
      toast.info(t.RepositoryLayout.stylePickerUrlLimited);
      setPickerDebugStatus('error');
      setPickerDebugNote('Picker unavailable for current preview mode');
      return;
    }

    setIsPickerActive((prev) => {
      const next = !prev;
      isPickerActiveRef.current = next;
      setPickerDebugStatus(next ? 'active' : 'ready');
      setPickerDebugNote(
        next ? 'Inspector mode enabled, move cursor into preview to highlight elements' : 'Picker manually disabled'
      );
      window.setTimeout(() => {
        postPickerToggle(next);
      }, 0);
      return next;
    });
  };

  const handleIframeLoad = () => {
    window.setTimeout(() => {
      postPickerToggle(isPickerActiveRef.current);
      if (isPickerActiveRef.current) {
        setPickerDebugStatus('active');
        setPickerDebugNote('Inspector mode ready, move cursor into preview to inspect elements');
      }
    }, 80);
  };

  return (
    <div className="flex h-full flex-col bg-background pb-1">
      <div className="flex flex-col gap-2 border-b bg-muted/20 px-2 py-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Input
            className="h-8 text-xs"
            value={addressInput}
            onChange={(event) => setAddressInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={t.RepositoryLayout.browserAddressPlaceholder}
          />
          <Button size="sm" className="h-8 px-3 text-xs" onClick={handleSubmit}>
            {t.RepositoryLayout.openBrowser}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleSubmit}
                disabled={!addressInput.trim()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t.RepositoryLayout.refreshBrowser}</p>
            </TooltipContent>
          </Tooltip>
          {onClose && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onClose}>
              {t.RepositoryLayout.closeBrowser}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="truncate">{sourceLabel}</div>
          <div className="shrink-0">
            {isPickerActive
              ? t.RepositoryLayout.stylePickerActive
              : t.RepositoryLayout.stylePickerIdle}
          </div>
        </div>
        <div className="rounded-md border bg-background/80 px-2 py-2 text-[11px] text-muted-foreground">
          <div className="font-medium text-foreground">Picker debug</div>
          <div className="mt-1 grid gap-1">
            <div>Status: {pickerDebugStatus}</div>
            <div className="truncate">Selector: {pickerDebugSelector || '-'}</div>
            <div>Tag: {pickerDebugTag || '-'}</div>
            <div className="truncate">Note: {pickerDebugNote || '-'}</div>
            <div>Last copy: {pickerLastSummary ? 'ready' : '-'}</div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-muted/10">
        {isLoadingLocalhostPreview ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t.RepositoryLayout.localhostPreviewLoading}</span>
          </div>
        ) : localhostPreviewDocument ? (
          <iframe
            ref={iframeRef}
            className="h-full w-full bg-white"
            srcDoc={localhostPreviewDocument}
            title="Project browser localhost preview"
            onLoad={handleIframeLoad}
          />
        ) : sourceType === 'url' && currentUrl ? (
          <iframe
            ref={iframeRef}
            className="h-full w-full bg-white"
            src={currentUrl}
            title="Project browser"
          />
        ) : filePreviewDocument ? (
          <iframe
            ref={iframeRef}
            className="h-full w-full bg-white"
            srcDoc={filePreviewDocument}
            title="Project browser"
            onLoad={handleIframeLoad}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Globe className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-sm">{t.RepositoryLayout.browserPanelTitle}</h3>
              <p className="text-muted-foreground text-sm">
                {t.RepositoryLayout.browserPanelDescription}
              </p>
            </div>
          </div>
        )}

        {localhostPreviewFailed && (
          <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
            {t.RepositoryLayout.localhostPreviewLoadFailed}
          </div>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              className="absolute bottom-4 right-4 z-10 h-10 w-10 rounded-full shadow-lg"
              variant={isPickerActive ? 'default' : 'secondary'}
              onClick={handleTogglePicker}
            >
              <MousePointerClick className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>
              {canUsePicker
                ? isPickerActive
                  ? t.RepositoryLayout.stylePickerActiveHint
                  : t.RepositoryLayout.stylePickerActivate
                : t.RepositoryLayout.stylePickerUrlLimited}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
