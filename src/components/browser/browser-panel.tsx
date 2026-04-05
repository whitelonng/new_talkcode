import { Globe, MousePointerClick, RefreshCw } from 'lucide-react';
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

const PICKER_MSG_TYPE = 'talkcody-picker';

function isHtmlLikeFile(filePath: string | null): boolean {
  if (!filePath) return false;
  return /\.(html?|svg)$/i.test(filePath);
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}

/**
 * Build the picker script that runs INSIDE the iframe.
 * Communicates with parent via postMessage — no cross-origin issues.
 */
function buildPickerScript(): string {
  return `
<script data-talkcody-picker-runtime="true">
(function() {
  var OVERLAY_ID = 'talkcody-style-picker-overlay';
  var HIGHLIGHT_ID = 'talkcody-style-picker-highlight';
  var LABEL_ID = 'talkcody-style-picker-label';
  var active = false;
  var highlightedEl = null;

  function isPickerEl(el) {
    return el && (el.id === OVERLAY_ID || el.id === HIGHLIGHT_ID || el.id === LABEL_ID);
  }

  function ensureOverlay() {
    var h = document.getElementById(HIGHLIGHT_ID);
    if (h) return h;
    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    var highlight = document.createElement('div');
    highlight.id = HIGHLIGHT_ID;
    highlight.style.cssText = 'position:fixed;border:1.5px dashed rgba(99,102,241,0.8);background:rgba(99,102,241,0.06);border-radius:2px;pointer-events:none;z-index:2147483647;display:none;transition:top .05s,left .05s,width .05s,height .05s;';
    var label = document.createElement('div');
    label.id = LABEL_ID;
    label.style.cssText = 'position:absolute;top:-20px;left:-1px;padding:1px 6px;font-size:10px;font-family:ui-monospace,monospace;line-height:16px;color:#fff;background:rgba(99,102,241,0.85);border-radius:2px 2px 0 0;white-space:nowrap;pointer-events:none;';
    highlight.appendChild(label);
    overlay.appendChild(highlight);
    document.body.appendChild(overlay);
    return highlight;
  }

  function clearHighlight() {
    var h = document.getElementById(HIGHLIGHT_ID);
    if (h) h.style.display = 'none';
    highlightedEl = null;
  }

  function resolveTarget(e) {
    var vw = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 1);
    var vh = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 1);
    var x = Math.min(Math.max(e.clientX, 1), vw - 1);
    var y = Math.min(Math.max(e.clientY, 1), vh - 1);
    var target = document.elementFromPoint(x, y);
    if (!target) return null;
    if (isPickerEl(target)) return highlightedEl;
    if (target === document.documentElement || target === document.body) {
      var stack = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
      for (var i = 0; i < stack.length; i++) {
        var el = stack[i];
        if (el === document.documentElement || el === document.body) continue;
        if (isPickerEl(el)) continue;
        return el;
      }
      return null;
    }
    return target;
  }

  function updateHighlight(el) {
    var h = ensureOverlay();
    if (!el) { clearHighlight(); return; }
    if (isPickerEl(el)) return;
    var rect = el.getBoundingClientRect();
    var vw = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 1);
    var vh = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 1);
    if (rect.width <= 0 && rect.height <= 0) { clearHighlight(); return; }
    if (rect.width >= vw * 0.85 && rect.height >= vh * 0.85) { clearHighlight(); return; }
    highlightedEl = el;
    h.style.display = 'block';
    h.style.left = rect.left + 'px';
    h.style.top = rect.top + 'px';
    h.style.width = rect.width + 'px';
    h.style.height = rect.height + 'px';
    var lbl = document.getElementById(LABEL_ID);
    if (lbl) {
      var tag = el.tagName.toLowerCase();
      var cls = Array.from(el.classList).filter(Boolean).slice(0, 2).join('.');
      lbl.textContent = cls ? tag + '.' + cls : tag;
    }
  }

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && depth < 4) {
      var part = cur.tagName.toLowerCase();
      var cn = Array.from(cur.classList).filter(Boolean).slice(0, 2);
      if (cn.length > 0) part += '.' + cn.join('.');
      var parent = cur.parentElement;
      if (parent) {
        var tag = cur.tagName;
        var sibs = Array.from(parent.children).filter(function(c) { return c.tagName === tag; });
        if (sibs.length > 1) part += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
      }
      parts.unshift(part);
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function buildSummary(el) {
    var text = (el.textContent || '').replace(/s+/g, ' ').trim().slice(0, 200);
    var classes = Array.from(el.classList).filter(Boolean).join(' ');
    var inlineStyle = el.getAttribute('style') || '';
    var selector = getSelector(el);
    var fields = [
      ['selector', selector],
      ['tag', el.tagName.toLowerCase()],
      ['id', el.id || ''],
      ['classes', classes],
      ['text', text],
      ['href', el.getAttribute('href') || ''],
      ['src', el.getAttribute('src') || ''],
      ['alt', el.getAttribute('alt') || ''],
      ['title', el.getAttribute('title') || ''],
      ['name', el.getAttribute('name') || ''],
      ['role', el.getAttribute('role') || ''],
      ['aria-label', el.getAttribute('aria-label') || ''],
      ['placeholder', el.getAttribute('placeholder') || ''],
      ['inline style', inlineStyle],
    ];

    return fields
      .filter(function(entry) {
        return Boolean(entry[1]);
      })
      .map(function(entry) {
        return entry[0] + ': ' + entry[1];
      })
      .join('\\n');
  }

  // --- Event handlers ---

  document.addEventListener('mousemove', function(e) {
    if (!active) return;
    var target = resolveTarget(e);
    updateHighlight(target);
  }, false);

  document.addEventListener('mouseleave', function() {
    clearHighlight();
  }, false);

  document.addEventListener('scroll', function() {
    if (!active || !highlightedEl) return;
    updateHighlight(highlightedEl);
  }, false);

  document.addEventListener('click', function(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation && e.stopImmediatePropagation();
    var el = resolveTarget(e);
    if (!el) return;
    active = false;
    document.documentElement.style.cursor = '';
    var summary = buildSummary(el);
    clearHighlight();
    window.parent.postMessage({
      type: '${PICKER_MSG_TYPE}',
      action: 'picked',
      summary: summary,
      selector: getSelector(el),
      tag: el.tagName.toLowerCase()
    }, '*');
  }, true);

  // Also block mousedown/pointerdown to prevent drag and link activation
  document.addEventListener('mousedown', function(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  document.addEventListener('pointerdown', function(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // Listen for messages from parent to activate/deactivate
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== '${PICKER_MSG_TYPE}') return;
    if (e.data.action === 'activate') {
      active = true;
      document.documentElement.style.cursor = 'crosshair';
    } else if (e.data.action === 'deactivate') {
      active = false;
      document.documentElement.style.cursor = '';
      clearHighlight();
    }
  }, false);
})();
</script>`;
}

function buildPickerStyles(): string {
  return `
    <style data-talkcody-picker-styles="true">
      #talkcody-style-picker-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483647;
      }
      #talkcody-style-picker-highlight {
        position: fixed;
        border: 1.5px dashed rgba(99, 102, 241, 0.8);
        background: rgba(99, 102, 241, 0.06);
        border-radius: 2px;
        pointer-events: none;
        z-index: 2147483647;
        display: none;
      }
      #talkcody-style-picker-label {
        position: absolute;
        top: -20px;
        left: -1px;
        padding: 1px 6px;
        font-size: 10px;
        font-family: ui-monospace, monospace;
        line-height: 16px;
        color: #fff;
        background: rgba(99, 102, 241, 0.85);
        border-radius: 2px 2px 0 0;
        white-space: nowrap;
        pointer-events: none;
      }
    </style>
  `;
}

function buildHtmlDocument(rawHtml: string, baseUrl?: string): string {
  const pickerStyles = buildPickerStyles();
  const pickerScript = buildPickerScript();
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
    ${pickerStyles}
  `;

  if (/<!doctype\s+html>/i.test(rawHtml) || /<html\b/i.test(rawHtml)) {
    let html = rawHtml;

    if (/<head\b/i.test(html)) {
      html = html.replace(/<head\b[^>]*>/i, (match) => `${match}${headInjection}`);
    } else {
      html = html.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${headInjection}</head>`);
    }

    // Inject script before </body> or at end
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${pickerScript}</body>`);
    } else {
      html += pickerScript;
    }

    return html;
  }

  return `<!doctype html>
<html>
  <head>
    ${headInjection}
  </head>
  <body>
    ${rawHtml}
    ${pickerScript}
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
  if (!currentFilePath || !currentContent) return null;
  if (isHtmlLikeFile(currentFilePath)) return buildHtmlDocument(currentContent);
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
  const [addressInput, setAddressInput] = useState(currentUrl);
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setAddressInput(currentUrl);
  }, [currentUrl]);

  // Send activate/deactivate message to iframe
  const sendPickerMessage = useCallback((action: 'activate' | 'deactivate') => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: PICKER_MSG_TYPE, action }, '*');
  }, []);

  // Listen for postMessage from iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data || event.data.type !== PICKER_MSG_TYPE) return;
      if (event.data.action === 'picked') {
        setIsPickerActive(false);
        try {
          await navigator.clipboard.writeText(event.data.summary);
          toast.success(t.RepositoryLayout.stylePickerCopied);
        } catch {
          toast.error(t.RepositoryLayout.stylePickerCopyFailed);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [t]);

  // Sync picker state to iframe when toggled
  useEffect(() => {
    sendPickerMessage(isPickerActive ? 'activate' : 'deactivate');
  }, [isPickerActive, sendPickerMessage]);

  // Reset picker when source changes
  useEffect(() => {
    if (sourceType === 'file') return;
    if (sourceType === 'url' && isLocalhostUrl(currentUrl)) return;
    setIsPickerActive(false);
  }, [sourceType, currentUrl]);

  const isLocalhostPreview = sourceType === 'url' && !!currentUrl && isLocalhostUrl(currentUrl);
  const canUsePicker =
    (sourceType === 'file' && isHtmlLikeFile(currentFilePath) && !!currentContent) ||
    isLocalhostPreview;

  const filePreviewDocument = useMemo(
    () => buildFilePreviewDocument(currentContent, currentFilePath),
    [currentContent, currentFilePath]
  );

  const sourceLabel = currentFilePath || currentUrl || t.RepositoryLayout.browserEmptyState;

  const handleSubmit = () => {
    const normalizedUrl = normalizeUrl(addressInput);
    if (!normalizedUrl) return;
    onOpenUrl(normalizedUrl);
  };

  const handleRefresh = () => {
    if (sourceType === 'file') {
      // Force iframe re-render for file previews
      setRefreshKey((k) => k + 1);
    } else if (sourceType === 'url' && iframeRef.current) {
      // Reload URL-based iframe
      const iframe = iframeRef.current;
      if (iframe.src) {
        const currentSrc = iframe.src;
        iframe.src = '';
        iframe.src = currentSrc;
      }
    }
  };

  const handleTogglePicker = () => {
    if (!canUsePicker) {
      toast.info(t.RepositoryLayout.stylePickerUrlLimited);
      return;
    }
    setIsPickerActive((prev) => !prev);
  };

  const handleIframeLoad = () => {
    // Re-sync picker state after iframe loads
    if (isPickerActive) {
      sendPickerMessage('activate');
    }
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
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
      </div>

      <div className="relative flex-1 overflow-hidden bg-muted/10">
        {isLocalhostPreview ? (
          <iframe
            ref={iframeRef}
            className="h-full w-full bg-white"
            src={currentUrl}
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
            key={refreshKey}
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

        {isPickerActive && (
          <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-md bg-indigo-500/90 px-3 py-1 text-xs text-white shadow-md">
            {t.RepositoryLayout.stylePickerActiveHint}
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
