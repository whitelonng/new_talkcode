import { invoke } from '@tauri-apps/api/core';
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
import { browserBridgeService } from '@/services/browser-bridge-service';
import {
  buildBrowserBridgeSessionMeta,
  useBrowserStore,
  type BrowserBridgeCommand,
  type BrowserBridgeMode,
  type BrowserBridgeSessionMeta,
  type BrowserBridgeStatus,
} from '@/stores/browser-store';
import type { BrowserNativeStateResponse } from '@/types/browser-control';

interface BrowserPanelProps {
  sourceType: 'none' | 'url' | 'file';
  currentUrl: string;
  currentFilePath: string | null;
  currentContent: string | null;
  onOpenUrl: (url: string) => void;
  onClose?: () => void;
}

const PICKER_MSG_TYPE = 'talkcody-picker';
const BRIDGE_MSG_TYPE = 'talkcody-browser-bridge';

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
  return value
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function createSessionId(): string {
  return `browser-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildBridgeRuntime(sessionId: string): string {
  return `
<script data-talkcody-picker-runtime="true">
(function() {
  var OVERLAY_ID = 'talkcody-style-picker-overlay';
  var HIGHLIGHT_ID = 'talkcody-style-picker-highlight';
  var LABEL_ID = 'talkcody-style-picker-label';
  var active = false;
  var highlightedEl = null;
  var BRIDGE_TYPE = '${BRIDGE_MSG_TYPE}';
  var PICKER_TYPE = '${PICKER_MSG_TYPE}';
  var SESSION_ID = ${JSON.stringify(sessionId)};
  var consoleEntries = [];
  var networkEntries = [];
  var networkRequestCounter = 0;

  function post(message) {
    window.parent.postMessage(message, '*');
  }

  function safeSerialize(value) {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }

  function recordConsole(level, argsLike) {
    try {
      var message = Array.prototype.slice.call(argsLike)
        .map(function(item) {
          if (typeof item === 'string') return item;
          try {
            return JSON.stringify(item);
          } catch {
            return String(item);
          }
        })
        .join(' ');
      var entry = { level: level, message: message, timestamp: Date.now() };
      consoleEntries.push(entry);
      if (consoleEntries.length > 200) consoleEntries = consoleEntries.slice(-200);
      post({ type: BRIDGE_TYPE, event: 'console', sessionId: SESSION_ID, entry: entry });
    } catch {}
  }

  function normalizeHeaders(headersLike) {
    if (!headersLike) return {};
    if (headersLike instanceof Headers) {
      var headerRecord = {};
      headersLike.forEach(function(value, key) {
        headerRecord[key] = value;
      });
      return headerRecord;
    }
    if (Array.isArray(headersLike)) {
      return headersLike.reduce(function(acc, item) {
        if (Array.isArray(item) && item.length >= 2) {
          acc[String(item[0])] = String(item[1]);
        }
        return acc;
      }, {});
    }
    if (typeof headersLike === 'object') {
      return Object.keys(headersLike).reduce(function(acc, key) {
        var value = headersLike[key];
        acc[key] = typeof value === 'string' ? value : String(value);
        return acc;
      }, {});
    }
    return {};
  }

  function toPreview(value, limit) {
    if (value == null) return null;
    var max = typeof limit === 'number' ? limit : 500;
    var text = typeof value === 'string' ? value : safeSerialize(value);
    if (typeof text !== 'string') {
      try {
        text = JSON.stringify(text);
      } catch {
        text = String(text);
      }
    }
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function nextNetworkRequestId() {
    networkRequestCounter += 1;
    return SESSION_ID + '-network-' + networkRequestCounter;
  }

  function recordNetwork(entry) {
    networkEntries.push(entry);
    if (networkEntries.length > 200) networkEntries = networkEntries.slice(-200);
    post({ type: BRIDGE_TYPE, event: 'network', sessionId: SESSION_ID, entry: entry });
  }

  function installNetworkHooks() {
    if (window.__talkcodyNetworkHooksInstalled) return;
    window.__talkcodyNetworkHooksInstalled = true;

    var originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = function(input, init) {
        var startedAt = Date.now();
        var requestId = nextNetworkRequestId();
        var method = init && init.method ? String(init.method).toUpperCase() : 'GET';
        var url = typeof input === 'string' ? input : input && typeof input.url === 'string' ? input.url : String(input);
        var requestHeaders = normalizeHeaders((init && init.headers) || (input && input.headers));
        var requestBodyPreview = toPreview(init && init.body ? init.body : null, 500);

        return originalFetch.call(window, input, init).then(function(response) {
          var cloned = response && typeof response.clone === 'function' ? response.clone() : null;
          return Promise.resolve(cloned ? cloned.text().catch(function() { return null; }) : null).then(function(responseBodyPreview) {
            recordNetwork({
              requestId: requestId,
              url: url,
              method: method,
              status: typeof response.status === 'number' ? response.status : null,
              type: 'fetch',
              requestHeaders: requestHeaders,
              requestBodyPreview: requestBodyPreview,
              responseHeaders: normalizeHeaders(response.headers),
              responseBodyPreview: toPreview(responseBodyPreview, 500),
              startedAt: startedAt,
              durationMs: Date.now() - startedAt,
              success: response.ok,
              error: null,
            });
            return response;
          });
        }).catch(function(error) {
          recordNetwork({
            requestId: requestId,
            url: url,
            method: method,
            status: null,
            type: 'fetch',
            requestHeaders: requestHeaders,
            requestBodyPreview: requestBodyPreview,
            responseHeaders: {},
            responseBodyPreview: null,
            startedAt: startedAt,
            durationMs: Date.now() - startedAt,
            success: false,
            error: error && error.message ? error.message : String(error),
          });
          throw error;
        });
      };
    }

    var OriginalOpen = XMLHttpRequest.prototype.open;
    var OriginalSend = XMLHttpRequest.prototype.send;
    var OriginalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function(method, url) {
      this.__talkcodyNetworkMeta = {
        requestId: nextNetworkRequestId(),
        method: String(method || 'GET').toUpperCase(),
        url: String(url || ''),
        startedAt: 0,
        requestHeaders: {},
        requestBodyPreview: null,
      };
      return OriginalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      if (this.__talkcodyNetworkMeta) {
        this.__talkcodyNetworkMeta.requestHeaders[String(name)] = String(value);
      }
      return OriginalSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      var xhr = this;
      var meta = xhr.__talkcodyNetworkMeta || {
        requestId: nextNetworkRequestId(),
        method: 'GET',
        url: '',
        startedAt: 0,
        requestHeaders: {},
        requestBodyPreview: null,
      };
      meta.startedAt = Date.now();
      meta.requestBodyPreview = toPreview(body, 500);
      xhr.__talkcodyNetworkMeta = meta;

      function finalize(success, error) {
        var responseHeadersRaw = xhr.getAllResponseHeaders ? xhr.getAllResponseHeaders() : '';
        var responseHeaders = responseHeadersRaw
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .reduce(function(acc, line) {
            var idx = line.indexOf(':');
            if (idx > 0) {
              acc[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
            }
            return acc;
          }, {});
        recordNetwork({
          requestId: meta.requestId,
          url: meta.url,
          method: meta.method,
          status: typeof xhr.status === 'number' ? xhr.status : null,
          type: 'xhr',
          requestHeaders: meta.requestHeaders,
          requestBodyPreview: meta.requestBodyPreview,
          responseHeaders: responseHeaders,
          responseBodyPreview: toPreview(xhr.responseText, 500),
          startedAt: meta.startedAt,
          durationMs: Date.now() - meta.startedAt,
          success: success,
          error: error || null,
        });
      }

      xhr.addEventListener('load', function() {
        finalize(xhr.status >= 200 && xhr.status < 400, null);
      }, { once: true });
      xhr.addEventListener('error', function() {
        finalize(false, 'XMLHttpRequest failed');
      }, { once: true });
      xhr.addEventListener('abort', function() {
        finalize(false, 'XMLHttpRequest aborted');
      }, { once: true });
      return OriginalSend.apply(xhr, arguments);
    };
  }

  ['log', 'info', 'warn', 'error'].forEach(function(level) {
    var original = console[level];
    console[level] = function() {
      recordConsole(level, arguments);
      return original ? original.apply(console, arguments) : undefined;
    };
  });

  function findElement(selector) {
    if (!selector || typeof selector !== 'string') {
      throw new Error('Selector is required.');
    }
    var element = document.querySelector(selector);
    if (!element) {
      throw new Error('Element not found: ' + selector);
    }
    return element;
  }

  function snapshot(selector) {
    var target = selector ? document.querySelector(selector) : document.body;
    if (!target) throw new Error('Snapshot target not found.');
    return {
      title: document.title,
      url: window.location.href,
      selector: selector || 'body',
      text: (target.innerText || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 4000),
      html: (target.outerHTML || '').slice(0, 4000),
      console: consoleEntries.slice(-50),
    };
  }

  function collectPageErrors() {
    return consoleEntries
      .filter(function(entry) {
        return entry.level === 'error';
      })
      .slice(-20);
  }

  function getPageState() {
    return {
      title: document.title,
      url: window.location.href,
      readyState: document.readyState,
      loading: document.readyState !== 'complete',
      errors: collectPageErrors(),
      consoleCount: consoleEntries.length,
      networkCount: networkEntries.length,
    };
  }

  function evaluateExpression(expression) {
    var source = String(expression || '').trim();
    if (!source) {
      throw new Error('Expression is required.');
    }
    var fn = new Function(
      'window',
      'document',
      'console',
      'return (' + source + ');'
    );
    return safeSerialize(fn(window, document, console));
  }

  function waitForNavigation(urlIncludes, timeoutMs, pollIntervalMs) {
    var expectedUrlPart = typeof urlIncludes === 'string' ? urlIncludes.trim() : '';
    var initialUrl = window.location.href;
    var timeout = typeof timeoutMs === 'number' ? timeoutMs : 10000;
    var poll = typeof pollIntervalMs === 'number' ? pollIntervalMs : 200;

    return new Promise(function(resolve, reject) {
      var start = Date.now();
      var timer = setInterval(function() {
        try {
          var currentUrl = window.location.href;
          var changed = currentUrl !== initialUrl;
          var matched = expectedUrlPart ? currentUrl.indexOf(expectedUrlPart) >= 0 : changed;
          if (matched) {
            clearInterval(timer);
            resolve({
              previousUrl: initialUrl,
              url: currentUrl,
              changed: changed,
              matched: true,
              elapsedMs: Date.now() - start,
            });
            return;
          }
          if (Date.now() - start >= timeout) {
            clearInterval(timer);
            reject(
              new Error(
                expectedUrlPart
                  ? 'WaitForNavigation timeout: ' + expectedUrlPart
                  : 'WaitForNavigation timeout: URL did not change'
              )
            );
          }
        } catch (error) {
          clearInterval(timer);
          reject(error);
        }
      }, poll);
    });
  }

  function normalizeElementState(state) {
    var value = String(state || 'visible');
    if (value === 'attached' || value === 'visible' || value === 'hidden' || value === 'enabled' || value === 'disabled') {
      return value;
    }
    throw new Error('Unsupported element state: ' + value);
  }

  function matchesElementState(element, state) {
    var normalized = normalizeElementState(state);
    if (normalized === 'attached') return !!element;
    if (!element) return false;
    if (normalized === 'visible') return isVisibleElement(element);
    if (normalized === 'hidden') return !isVisibleElement(element);
    if (normalized === 'enabled') return !isDisabledElement(element);
    if (normalized === 'disabled') return isDisabledElement(element);
    return false;
  }

  function waitForText(text, timeoutMs, pollIntervalMs) {
    var expectedText = String(text || '').trim();
    if (!expectedText) {
      throw new Error('Text is required.');
    }
    var timeout = typeof timeoutMs === 'number' ? timeoutMs : 10000;
    var poll = typeof pollIntervalMs === 'number' ? pollIntervalMs : 200;

    return new Promise(function(resolve, reject) {
      var start = Date.now();
      var timer = setInterval(function() {
        try {
          var pageText = (document.body && (document.body.innerText || document.body.textContent) || '')
            .replace(/\s+/g, ' ')
            .trim();
          if (pageText.indexOf(expectedText) >= 0) {
            clearInterval(timer);
            resolve({ text: expectedText, found: true, elapsedMs: Date.now() - start });
            return;
          }
          if (Date.now() - start >= timeout) {
            clearInterval(timer);
            reject(new Error('WaitForText timeout: ' + expectedText));
          }
        } catch (error) {
          clearInterval(timer);
          reject(error);
        }
      }, poll);
    });
  }

  function waitForElementState(selector, state, timeoutMs, pollIntervalMs) {
    if (!selector || typeof selector !== 'string') {
      throw new Error('Selector is required.');
    }
    var expectedState = normalizeElementState(state);
    var timeout = typeof timeoutMs === 'number' ? timeoutMs : 10000;
    var poll = typeof pollIntervalMs === 'number' ? pollIntervalMs : 200;

    return new Promise(function(resolve, reject) {
      var start = Date.now();
      var timer = setInterval(function() {
        try {
          var element = document.querySelector(selector);
          if (matchesElementState(element, expectedState)) {
            clearInterval(timer);
            resolve({
              selector: selector,
              state: expectedState,
              matched: true,
              elapsedMs: Date.now() - start,
            });
            return;
          }
          if (Date.now() - start >= timeout) {
            clearInterval(timer);
            reject(new Error('WaitForElementState timeout: ' + selector + ' -> ' + expectedState));
          }
        } catch (error) {
          clearInterval(timer);
          reject(error);
        }
      }, poll);
    });
  }

  function isVisibleElement(element) {
    if (!element || !(element instanceof Element)) return false;
    var style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) {
      return false;
    }
    var rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isDisabledElement(element) {
    return !!(
      element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLOptGroupElement ||
      element instanceof HTMLOptionElement ||
      element instanceof HTMLFieldSetElement
    ) && element.disabled;
  }

  function getAccessibleName(element) {
    return (
      element.getAttribute('aria-label') ||
      element.getAttribute('name') ||
      element.getAttribute('title') ||
      (element.textContent || '').replace(/\s+/g, ' ').trim()
    );
  }

  function getInteractiveRole(element) {
    return (
      element.getAttribute('role') ||
      (element instanceof HTMLAnchorElement
        ? 'link'
        : element instanceof HTMLButtonElement
          ? 'button'
          : element instanceof HTMLInputElement
            ? element.type || 'input'
            : element instanceof HTMLSelectElement
              ? 'select'
              : element instanceof HTMLTextAreaElement
                ? 'textbox'
                : element.isContentEditable
                  ? 'textbox'
                  : 'generic')
    );
  }

  function buildElementInfo(element, selector) {
    var text = (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    return {
      selector: selector || getSelector(element),
      tag: element.tagName.toLowerCase(),
      id: element.id || '',
      role: getInteractiveRole(element),
      name: getAccessibleName(element),
      text: text,
      placeholder: element.getAttribute('placeholder') || '',
      href: element.getAttribute('href') || '',
      value:
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
          ? element.value
          : element.isContentEditable
            ? element.textContent || ''
            : '',
      visible: isVisibleElement(element),
      disabled: isDisabledElement(element),
      clickable:
        !isDisabledElement(element) &&
        (element instanceof HTMLButtonElement ||
          element instanceof HTMLAnchorElement ||
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement ||
          element.getAttribute('role') === 'button' ||
          typeof element.onclick === 'function'),
    };
  }

  function queryElements(selector, limit) {
    if (!selector || typeof selector !== 'string') {
      throw new Error('Selector is required.');
    }
    var max = typeof limit === 'number' ? limit : 100;
    return Array.from(document.querySelectorAll(selector))
      .filter(function(element) {
        return !isPickerEl(element);
      })
      .slice(0, max)
      .map(function(element) {
        return buildElementInfo(element, getSelector(element));
      });
  }

  function buildDomTreeNode(element, depth, maxDepth, maxChildren) {
    if (!element || !(element instanceof Element)) return null;
    var info = buildElementInfo(element, getSelector(element));
    var node = {
      selector: info.selector,
      tag: info.tag,
      id: info.id,
      role: info.role,
      name: info.name,
      text: info.text,
      visible: info.visible,
      disabled: info.disabled,
      clickable: info.clickable,
      childCount: element.children ? element.children.length : 0,
      children: [],
    };

    if (depth >= maxDepth) {
      return node;
    }

    node.children = Array.from(element.children || [])
      .filter(function(child) {
        return !isPickerEl(child);
      })
      .slice(0, maxChildren)
      .map(function(child) {
        return buildDomTreeNode(child, depth + 1, maxDepth, maxChildren);
      })
      .filter(Boolean);

    return node;
  }

  function getDomTree(selector, maxDepth, maxChildren) {
    var root = selector ? document.querySelector(selector) : document.body;
    if (!root) {
      throw new Error('DOM tree root not found.');
    }
    var depth = typeof maxDepth === 'number' ? maxDepth : 4;
    var children = typeof maxChildren === 'number' ? maxChildren : 20;
    return buildDomTreeNode(root, 0, depth, children);
  }

  function listInteractiveElements(limit) {
    var max = typeof limit === 'number' ? limit : 200;
    var selector = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[contenteditable="true"]',
      '[tabindex]'
    ].join(',');

    return Array.from(document.querySelectorAll(selector))
      .filter(function(element) {
        return !isPickerEl(element);
      })
      .slice(0, max)
      .map(function(element) {
        return buildElementInfo(element, getSelector(element));
      });
  }

  function getElementInfo(selector) {
    var element = findElement(selector);
    return buildElementInfo(element, selector);
  }

  function pressKey(key) {
    var target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
    var value = String(key || '').trim();
    if (!value) throw new Error('Key is required.');
    var eventInit = { key: value, bubbles: true, cancelable: true };
    target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    if (value === 'Enter' && target instanceof HTMLElement && typeof target.click === 'function') {
      target.click();
    }
    return { key: value, targetTag: target.tagName.toLowerCase() };
  }

  function clearConsoleEntries() {
    consoleEntries = [];
    return { cleared: true };
  }

  function getNetworkLogs(limit) {
    var max = typeof limit === 'number' ? limit : 50;
    return networkEntries.slice(-max);
  }

  function clearNetworkEntries() {
    networkEntries = [];
    return { cleared: true };
  }

  function waitFor(selector, timeoutMs, pollIntervalMs) {
    var timeout = typeof timeoutMs === 'number' ? timeoutMs : 10000;
    var poll = typeof pollIntervalMs === 'number' ? pollIntervalMs : 200;

    return new Promise(function(resolve, reject) {
      var start = Date.now();
      var timer = setInterval(function() {
        try {
          if (selector) {
            var el = document.querySelector(selector);
            if (el) {
              clearInterval(timer);
              resolve({ selector: selector, found: true, elapsedMs: Date.now() - start });
              return;
            }
          } else if (document.readyState === 'complete') {
            clearInterval(timer);
            resolve({ readyState: document.readyState, elapsedMs: Date.now() - start });
            return;
          }

          if (Date.now() - start >= timeout) {
            clearInterval(timer);
            reject(
              new Error(
                selector
                  ? 'WaitFor timeout: ' + selector
                  : 'WaitFor timeout: document.readyState'
              )
            );
          }
        } catch (error) {
          clearInterval(timer);
          reject(error);
        }
      }, poll);
    });
  }

  function scrollTarget(params) {
    var selector = typeof params.selector === 'string' ? params.selector : null;
    var x = typeof params.x === 'number' ? params.x : 0;
    var y = typeof params.y === 'number' ? params.y : 0;
    var mode = params.mode === 'to' ? 'to' : 'by';
    var behavior = params.behavior === 'smooth' ? 'smooth' : 'auto';

    if (selector) {
      var el = findElement(selector);
      if (mode === 'to' && typeof el.scrollTo === 'function') {
        el.scrollTo({ left: x, top: y, behavior: behavior });
      } else if (typeof el.scrollBy === 'function') {
        el.scrollBy({ left: x, top: y, behavior: behavior });
      } else {
        el.scrollLeft = mode === 'to' ? x : el.scrollLeft + x;
        el.scrollTop = mode === 'to' ? y : el.scrollTop + y;
      }
      return { selector: selector, left: el.scrollLeft, top: el.scrollTop };
    }

    if (mode === 'to') {
      window.scrollTo({ left: x, top: y, behavior: behavior });
    } else {
      window.scrollBy({ left: x, top: y, behavior: behavior });
    }
    return { x: window.scrollX, y: window.scrollY };
  }

  function flashHighlight(selector, durationMs) {
    var el = findElement(selector);
    updateHighlight(el);
    window.setTimeout(function() {
      if (!active) {
        clearHighlight();
      }
    }, typeof durationMs === 'number' ? durationMs : 2000);
    return { selector: selector, highlighted: true };
  }

  function typeInto(element, text) {
    var value = text == null ? '' : String(text);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.focus();
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return { value: element.value };
    }
    if (element.isContentEditable) {
      element.focus();
      element.textContent = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return { value: element.textContent || '' };
    }
    throw new Error('Target element is not typable.');
  }

  function focusElement(selector) {
    var element = findElement(selector);
    if (!(element instanceof HTMLElement)) {
      throw new Error('Target element is not focusable.');
    }
    element.focus();
    return { selector: selector, focused: document.activeElement === element };
  }

  function blurElement(selector) {
    var element = findElement(selector);
    if (!(element instanceof HTMLElement)) {
      throw new Error('Target element is not blur-able.');
    }
    element.blur();
    return { selector: selector, blurred: document.activeElement !== element };
  }

  function hoverElement(selector) {
    var element = findElement(selector);
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window }));
    return { selector: selector, hovered: true };
  }

  function selectOption(selector, value, label, index) {
    var element = findElement(selector);
    if (!(element instanceof HTMLSelectElement)) {
      throw new Error('Target element is not a select element.');
    }

    var option = null;
    if (value != null) {
      option = Array.from(element.options).find(function(item) {
        return item.value === String(value);
      }) || null;
    }
    if (!option && label != null) {
      option = Array.from(element.options).find(function(item) {
        return item.text === String(label);
      }) || null;
    }
    if (!option && typeof index === 'number') {
      option = element.options[index] || null;
    }
    if (!option) {
      throw new Error('Select option not found.');
    }

    element.value = option.value;
    option.selected = true;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      selector: selector,
      value: element.value,
      label: option.text,
      selectedIndex: element.selectedIndex,
    };
  }

  function setCheckedState(selector, checked) {
    var element = findElement(selector);
    if (!(element instanceof HTMLInputElement) || (element.type !== 'checkbox' && element.type !== 'radio')) {
      throw new Error('Target element is not a checkbox or radio input.');
    }
    element.checked = checked;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { selector: selector, checked: element.checked, type: element.type };
  }

  async function runCommand(command) {
    var kind = command.kind;
    var params = command.params || {};
    if (kind === 'click') {
      var clickEl = findElement(params.selector);
      if (typeof clickEl.click === 'function') {
        clickEl.click();
      } else {
        clickEl.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
        );
      }
      return { selector: params.selector, clicked: true };
    }
    if (kind === 'type') {
      return typeInto(findElement(params.selector), params.text);
    }
    if (kind === 'focus') {
      return focusElement(params.selector);
    }
    if (kind === 'blur') {
      return blurElement(params.selector);
    }
    if (kind === 'hover') {
      return hoverElement(params.selector);
    }
    if (kind === 'selectOption') {
      return selectOption(params.selector, params.value, params.label, params.index);
    }
    if (kind === 'check') {
      return setCheckedState(params.selector, true);
    }
    if (kind === 'uncheck') {
      return setCheckedState(params.selector, false);
    }
    if (kind === 'executeScript') {
      var fn = new Function('window', 'document', 'console', String(params.script || 'return null;'));
      return safeSerialize(fn(window, document, console));
    }
    if (kind === 'evaluateExpression') {
      return evaluateExpression(params.expression);
    }
    if (kind === 'snapshot') {
      return snapshot(typeof params.selector === 'string' ? params.selector : undefined);
    }
    if (kind === 'waitFor') {
      return await waitFor(
        typeof params.selector === 'string' ? params.selector : undefined,
        typeof params.timeoutMs === 'number' ? params.timeoutMs : undefined,
        typeof params.pollIntervalMs === 'number' ? params.pollIntervalMs : undefined
      );
    }
    if (kind === 'waitForNavigation') {
      return await waitForNavigation(params.urlIncludes, params.timeoutMs, params.pollIntervalMs);
    }
    if (kind === 'scroll') {
      return scrollTarget(params);
    }
    if (kind === 'highlightElement') {
      return flashHighlight(params.selector, params.durationMs);
    }
    if (kind === 'listInteractiveElements') {
      return listInteractiveElements(params.limit);
    }
    if (kind === 'getElementInfo') {
      return getElementInfo(params.selector);
    }
    if (kind === 'pressKey') {
      return pressKey(params.key);
    }
    if (kind === 'clearConsole') {
      return clearConsoleEntries();
    }
    if (kind === 'getNetworkLogs') {
      return getNetworkLogs(params.limit);
    }
    if (kind === 'clearNetworkLogs') {
      return clearNetworkEntries();
    }
    if (kind === 'getPageState') {
      return getPageState();
    }
    if (kind === 'waitForText') {
      return await waitForText(params.text, params.timeoutMs, params.pollIntervalMs);
    }
    if (kind === 'waitForElementState') {
      return await waitForElementState(
        params.selector,
        params.state,
        params.timeoutMs,
        params.pollIntervalMs
      );
    }
    if (kind === 'queryElements') {
      return queryElements(params.selector, params.limit);
    }
    if (kind === 'getDomTree') {
      return getDomTree(params.selector, params.maxDepth, params.maxChildren);
    }
    throw new Error('Unsupported browser bridge command: ' + kind);
  }

  function isPickerEl(el) {
    return el && (el.id === OVERLAY_ID || el.id === HIGHLIGHT_ID || el.id === LABEL_ID);
  }

  function ensureOverlay() {
    var existing = document.getElementById(HIGHLIGHT_ID);
    if (existing) return existing;
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
        if (el === document.documentElement || el === document.body || isPickerEl(el)) continue;
        return el;
      }
      return null;
    }
    return target;
  }

  function updateHighlight(el) {
    var h = ensureOverlay();
    if (!el || isPickerEl(el)) {
      clearHighlight();
      return;
    }
    var rect = el.getBoundingClientRect();
    var vw = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 1);
    var vh = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 1);
    if ((rect.width <= 0 && rect.height <= 0) || (rect.width >= vw * 0.85 && rect.height >= vh * 0.85)) {
      clearHighlight();
      return;
    }
    highlightedEl = el;
    h.style.display = 'block';
    h.style.left = rect.left + 'px';
    h.style.top = rect.top + 'px';
    h.style.width = rect.width + 'px';
    h.style.height = rect.height + 'px';
    var lbl = document.getElementById(LABEL_ID);
    if (lbl) {
      var tag = el.tagName.toLowerCase();
      var cls = Array.from(el.classList)
        .filter(Boolean)
        .slice(0, 2)
        .join('.');
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
        var sibs = Array.from(parent.children).filter(function(c) {
          return c.tagName === tag;
        });
        if (sibs.length > 1) part += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
      }
      parts.unshift(part);
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function buildSummary(el) {
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    var classes = Array.from(el.classList).filter(Boolean).join(' ');
    var inlineStyle = el.getAttribute('style') || '';
    var selector = getSelector(el);
    return [
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
    ]
      .filter(function(entry) {
        return Boolean(entry[1]);
      })
      .map(function(entry) {
        return entry[0] + ': ' + entry[1];
      })
      .join('\\n');
  }

  document.addEventListener(
    'mousemove',
    function(e) {
      if (!active) return;
      updateHighlight(resolveTarget(e));
    },
    false
  );
  document.addEventListener(
    'mouseleave',
    function() {
      clearHighlight();
    },
    false
  );
  document.addEventListener(
    'scroll',
    function() {
      if (active && highlightedEl) updateHighlight(highlightedEl);
    },
    false
  );

  document.addEventListener(
    'click',
    function(e) {
      if (!active) return;
      var el = resolveTarget(e);
      if (!el || isPickerEl(el)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      updateHighlight(el);
      post({
        type: PICKER_TYPE,
        action: 'picked',
        sessionId: SESSION_ID,
        summary: buildSummary(el),
        selector: getSelector(el),
        tag: el.tagName.toLowerCase(),
      });
      active = false;
      clearHighlight();
    },
    true
  );

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.sessionId && data.sessionId !== SESSION_ID) return;

    if (data.type === PICKER_TYPE) {
      if (data.action === 'activate') {
        active = true;
        return;
      }
      if (data.action === 'deactivate') {
        active = false;
        clearHighlight();
        return;
      }
    }

    if (data.type === BRIDGE_TYPE && data.event === 'command' && data.command) {
      Promise.resolve()
        .then(function() {
          return runCommand(data.command);
        })
        .then(function(result) {
          post({
            type: BRIDGE_TYPE,
            event: 'result',
            sessionId: SESSION_ID,
            commandId: data.commandId,
            success: true,
            data: result,
            errorCode: null,
          });
        })
        .catch(function(error) {
          post({
            type: BRIDGE_TYPE,
            event: 'result',
            sessionId: SESSION_ID,
            commandId: data.commandId,
            success: false,
            error: error && error.message ? error.message : String(error),
            errorCode: 'COMMAND_FAILED',
          });
        });
    }
  });

  installNetworkHooks();

  post({
    type: BRIDGE_TYPE,
    event: 'ready',
    sessionId: SESSION_ID,
    capabilities: {
      navigation: 'available',
      domRead: 'available',
      domWrite: 'available',
      scriptEval: 'available',
      consoleRead: 'available',
      networkObserve: 'partial',
      screenshot: 'unavailable',
      keyboardInput: 'partial',
      mouseInput: 'partial',
      externalControl: 'partial'
    }
  });
})();
</script>`;
}

function injectIntoHtmlDocument(content: string, injection: string, baseUrl?: string): string {
  const baseTag = baseUrl ? `<base href="${escapeHtml(baseUrl)}">` : '';
  const combinedInjection = `${baseTag}${injection}`;

  if (/<head[^>]*>/i.test(content)) {
    return content.replace(/<head([^>]*)>/i, `<head$1>${combinedInjection}`);
  }
  if (/<body[^>]*>/i.test(content)) {
    return content.replace(/<body([^>]*)>/i, `<body$1>${combinedInjection}`);
  }
  return `${combinedInjection}${content}`;
}

function buildHtmlDocument(content: string | null, sessionId: string, baseUrl?: string): string {
  const safeContent = content || '<html><body></body></html>';
  return injectIntoHtmlDocument(safeContent, buildBridgeRuntime(sessionId), baseUrl);
}

function buildTextPreviewDocument(content: string | null): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 16px;
        font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Consolas, monospace;
        background: #0f172a;
        color: #e2e8f0;
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>${escapeHtml(content || '')}</body>
</html>`;
}

function buildFilePreviewDocument(
  currentContent: string | null,
  currentFilePath: string | null,
  sessionId: string
): string | null {
  if (!currentContent) return null;
  if (isHtmlLikeFile(currentFilePath)) return buildHtmlDocument(currentContent, sessionId);
  return buildTextPreviewDocument(currentContent);
}

function getUncontrolledMode(sourceType: BrowserPanelProps['sourceType'], url: string): BrowserBridgeMode {
  if (sourceType !== 'url') return 'none';
  if (/^https?:\/\//i.test(url) && !isLocalhostUrl(url)) {
    return 'externalEmbedded';
  }
  return 'none';
}

function getBridgeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildCapabilitySet(mode: BrowserBridgeMode) {
  if (mode === 'fileControlled' || mode === 'localhostControlled') {
    return {
      navigation: 'available',
      domRead: 'available',
      domWrite: 'available',
      scriptEval: 'available',
      consoleRead: 'available',
      networkObserve: 'partial',
      screenshot: 'unavailable',
      keyboardInput: 'partial',
      mouseInput: 'partial',
      externalControl: mode === 'localhostControlled' ? 'partial' : 'unavailable',
    } as const;
  }

  if (mode === 'externalNativeControlled') {
    return {
      navigation: 'available',
      domRead: 'partial',
      domWrite: 'partial',
      scriptEval: 'partial',
      consoleRead: 'partial',
      networkObserve: 'partial',
      screenshot: 'available',
      keyboardInput: 'available',
      mouseInput: 'available',
      externalControl: 'available',
    } as const;
  }

  if (mode === 'externalEmbedded') {
    return {
      navigation: 'available',
      domRead: 'unavailable',
      domWrite: 'unavailable',
      scriptEval: 'unavailable',
      consoleRead: 'unavailable',
      networkObserve: 'unavailable',
      screenshot: 'partial',
      keyboardInput: 'partial',
      mouseInput: 'partial',
      externalControl: 'partial',
    } as const;
  }

  return {
    navigation: 'available',
    domRead: 'unavailable',
    domWrite: 'unavailable',
    scriptEval: 'unavailable',
    consoleRead: 'unavailable',
    networkObserve: 'unavailable',
    screenshot: 'unavailable',
    keyboardInput: 'unavailable',
    mouseInput: 'unavailable',
    externalControl: 'unavailable',
  } as const;
}

function buildSessionMeta(input: {
  mode: BrowserBridgeMode;
  sourceType: BrowserPanelProps['sourceType'];
  currentUrl: string;
  currentFilePath: string | null;
}): BrowserBridgeSessionMeta {
  return buildBrowserBridgeSessionMeta({
    mode: input.mode,
    sourceType: input.sourceType,
    platform: input.mode === 'externalNativeControlled' ? 'windowsWebview2' : 'web',
    url: input.currentUrl || null,
    filePath: input.currentFilePath,
    isExternalPage: input.mode === 'externalEmbedded' || input.mode === 'externalNativeControlled',
    supportsNativeHost: input.mode === 'externalNativeControlled',
    capabilitySet: buildCapabilitySet(input.mode),
  });
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
  const sessionIdRef = useRef<string>(createSessionId());
  const nativeSessionIdRef = useRef<string | null>(null);
  const bridgeOriginRef = useRef<string | null>(null);
  const [addressInput, setAddressInput] = useState(currentUrl);
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [localhostDocument, setLocalhostDocument] = useState<string | null>(null);
  const [localhostError, setLocalhostError] = useState<string | null>(null);
  const [nativeSessionState, setNativeSessionState] = useState<BrowserNativeStateResponse | null>(null);
  const [isNativeSessionBusy, setIsNativeSessionBusy] = useState(false);
  const pendingBridgeCommand = useBrowserStore((state) => state.pendingBridgeCommand);
  const setBridgeSession = useBrowserStore((state) => state.setBridgeSession);
  const setBridgeStatus = useBrowserStore((state) => state.setBridgeStatus);
  const appendConsoleEntry = useBrowserStore((state) => state.appendConsoleEntry);
  const appendNetworkEntry = useBrowserStore((state) => state.appendNetworkEntry);
  const nativeModeEnabled = sourceType === 'url' && !!currentUrl && !isLocalhostUrl(currentUrl);

  const rotateSession = useCallback(
    (mode: BrowserBridgeMode, status: BrowserBridgeStatus) => {
      sessionIdRef.current = createSessionId();
      if (mode !== 'externalNativeControlled') {
        nativeSessionIdRef.current = null;
      }
      bridgeOriginRef.current = mode === 'localhostControlled' ? getBridgeOrigin(currentUrl) : null;
      browserBridgeService.clearPendingForSessionReset('Browser bridge session changed.');
      setBridgeSession(
        sessionIdRef.current,
        status,
        buildSessionMeta({
          mode,
          sourceType,
          currentUrl,
          currentFilePath,
        })
      );
    },
    [currentFilePath, currentUrl, setBridgeSession, sourceType]
  );

  useEffect(() => {
    setAddressInput(currentUrl);
  }, [currentUrl]);

  useEffect(() => {
    let cancelled = false;

    async function prepareLocalhostBridge() {
      if (!(sourceType === 'url' && currentUrl && isLocalhostUrl(currentUrl))) {
        setLocalhostDocument(null);
        setLocalhostError(null);
        return;
      }

      rotateSession('localhostControlled', 'loading');
      setLocalhostDocument(null);
      setLocalhostError(null);

      try {
        const response = await simpleFetch(currentUrl, {
          method: 'GET',
          headers: {
            'x-talkcody-allow-private-ip': 'true',
          },
        });
        const html = await response.text();
        if (cancelled) return;
        setLocalhostDocument(buildHtmlDocument(html, sessionIdRef.current, currentUrl));
        setBridgeStatus(
          'loading',
          null,
          null,
          buildSessionMeta({
            mode: 'localhostControlled',
            sourceType,
            currentUrl,
            currentFilePath,
          })
        );
      } catch (error) {
        logger.error('[BrowserPanel] Failed to load localhost preview', error);
        if (cancelled) return;
        setLocalhostError(error instanceof Error ? error.message : String(error));
        rotateSession('externalEmbedded', 'error');
        toast.error(t.RepositoryLayout.localhostPreviewLoadFailed);
      }
    }

    prepareLocalhostBridge();
    return () => {
      cancelled = true;
    };
  }, [currentFilePath, currentUrl, rotateSession, setBridgeStatus, sourceType, t]);

  useEffect(() => {
    if (sourceType === 'file') {
      rotateSession('fileControlled', 'loading');
      setLocalhostDocument(null);
      setLocalhostError(null);
      return;
    }
    if (nativeModeEnabled) {
      rotateSession('externalNativeControlled', 'initializing');
      setLocalhostDocument(null);
      setLocalhostError(null);
      return;
    }
    if (sourceType === 'url' && currentUrl && !isLocalhostUrl(currentUrl)) {
      rotateSession(getUncontrolledMode(sourceType, currentUrl), 'ready');
      setLocalhostDocument(null);
      setLocalhostError(null);
      return;
    }
    if (sourceType === 'none') {
      rotateSession('none', 'idle');
      setLocalhostDocument(null);
      setLocalhostError(null);
    }
  }, [currentUrl, nativeModeEnabled, rotateSession, sourceType]);

  const sendPickerMessage = useCallback(
    (action: 'activate' | 'deactivate') => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      iframe.contentWindow.postMessage(
        { type: PICKER_MSG_TYPE, action, sessionId: sessionIdRef.current },
        bridgeOriginRef.current ?? '*'
      );
    },
    []
  );

  const sendBridgeCommand = useCallback((command: BrowserBridgeCommand) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      browserBridgeService.rejectCommand(command.id, 'Built-in browser iframe is not ready.', 'IFRAME_NOT_READY');
      return;
    }

    iframe.contentWindow.postMessage(
      {
        type: BRIDGE_MSG_TYPE,
        event: 'command',
        sessionId: sessionIdRef.current,
        commandId: command.id,
        command,
      },
      bridgeOriginRef.current ?? '*'
    );
  }, []);

  useEffect(() => {
    if (!pendingBridgeCommand) return;
    sendBridgeCommand(pendingBridgeCommand);
  }, [pendingBridgeCommand, sendBridgeCommand]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === PICKER_MSG_TYPE) {
        if (event.data.sessionId !== sessionIdRef.current || event.data.action !== 'picked') return;
        setIsPickerActive(false);
        try {
          await navigator.clipboard.writeText(event.data.summary);
          toast.success(t.RepositoryLayout.stylePickerCopied);
        } catch {
          toast.error(t.RepositoryLayout.stylePickerCopyFailed);
        }
        return;
      }

      if (event.data.type !== BRIDGE_MSG_TYPE || event.data.sessionId !== sessionIdRef.current) return;

      if (event.data.event === 'ready') {
        setBridgeStatus(
          'ready',
          null,
          null,
          buildBrowserBridgeSessionMeta({
            ...buildSessionMeta({
              mode: sourceType === 'file' ? 'fileControlled' : 'localhostControlled',
              sourceType,
              currentUrl,
              currentFilePath,
            }),
            capabilitySet: {
              ...buildSessionMeta({
                mode: sourceType === 'file' ? 'fileControlled' : 'localhostControlled',
                sourceType,
                currentUrl,
                currentFilePath,
              }).capabilitySet,
              ...(event.data.capabilities ?? {}),
            },
          })
        );
        return;
      }

      if (event.data.event === 'console' && event.data.entry) {
        appendConsoleEntry(event.data.entry);
        return;
      }

      if (event.data.event === 'network' && event.data.entry) {
        appendNetworkEntry(event.data.entry);
        return;
      }

      if (event.data.event === 'result' && typeof event.data.commandId === 'string') {
        if (event.data.success) {
          browserBridgeService.resolveCommand(
            event.data.commandId,
            true,
            event.data.data,
            undefined,
            event.data.errorCode ?? undefined
          );
        } else {
          browserBridgeService.rejectCommand(
            event.data.commandId,
            event.data.error || 'Browser bridge command failed.',
            event.data.errorCode || 'COMMAND_FAILED'
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [appendConsoleEntry, appendNetworkEntry, currentFilePath, currentUrl, setBridgeStatus, sourceType, t]);

  useEffect(() => {
    sendPickerMessage(isPickerActive ? 'activate' : 'deactivate');
  }, [isPickerActive, sendPickerMessage]);

  useEffect(() => {
    if (sourceType === 'file') return;
    if (sourceType === 'url' && isLocalhostUrl(currentUrl) && localhostDocument) return;
    setIsPickerActive(false);
  }, [currentUrl, localhostDocument, sourceType]);

  useEffect(() => {
    if (sourceType !== 'url' || !currentUrl || isLocalhostUrl(currentUrl)) {
      nativeSessionIdRef.current = null;
      setNativeSessionState(null);
      return;
    }

    let disposed = false;
    const bridgeSessionId = sessionIdRef.current;

    const syncNativeState = (state: BrowserNativeStateResponse) => {
      const activeNativeSessionId = nativeSessionIdRef.current ?? bridgeSessionId;
      if (disposed || state.sessionId !== activeNativeSessionId) {
        return;
      }

      nativeSessionIdRef.current = state.sessionId;
      setNativeSessionState(state);
      const meta = buildSessionMeta({
        mode: 'externalNativeControlled',
        sourceType,
        currentUrl: state.url ?? currentUrl,
        currentFilePath,
      });
      setBridgeSession(state.sessionId, state.status, meta);
      setBridgeStatus(state.status, state.error ?? null, state.errorCode ?? null, meta);
    };

    void (async () => {
      try {
        const startResponse = await browserBridgeService.startNativeWindowsSession({
          sessionId: bridgeSessionId,
          url: currentUrl,
          mode: 'externalNativeControlled',
        });
        if (disposed) {
          return;
        }

        const startMeta = buildSessionMeta({
          mode: 'externalNativeControlled',
          sourceType,
          currentUrl,
          currentFilePath,
        });
        nativeSessionIdRef.current = startResponse.sessionId;
        setBridgeSession(startResponse.sessionId, startResponse.status, startMeta);
        setBridgeStatus(
          startResponse.status,
          startResponse.error ?? null,
          startResponse.errorCode ?? null,
          startMeta
        );

        const state = await browserBridgeService.getNativeWindowsState(startResponse.sessionId);
        syncNativeState(state);
      } catch (error) {
        logger.error('[BrowserPanel] Failed to start native browser session', error);
      }
    })();

    const unlistenPromise = browserBridgeService.listenNativeWindowsState((state) => {
      syncNativeState(state);
    });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [currentFilePath, currentUrl, localhostDocument, setBridgeSession, setBridgeStatus, sourceType]);

  const handleNativeClose = useCallback(async () => {
    const sessionId = nativeSessionIdRef.current ?? sessionIdRef.current;
    setIsNativeSessionBusy(true);
    try {
      const response = await browserBridgeService.closeNativeWindowsSession({ sessionId });
      nativeSessionIdRef.current = null;
      const meta = buildSessionMeta({
        mode: 'externalNativeControlled',
        sourceType,
        currentUrl: nativeSessionState?.url ?? currentUrl,
        currentFilePath,
      });
      setNativeSessionState((prev) =>
        prev
          ? {
              ...prev,
              status: response.status,
              error: response.error,
              errorCode: response.errorCode,
              closedAt: Date.now(),
            }
          : null
      );
      setBridgeSession(sessionId, response.status, meta);
      setBridgeStatus(response.status, response.error ?? null, response.errorCode ?? null, meta);
    } catch (error) {
      logger.error('[BrowserPanel] Failed to close native browser session', error);
    } finally {
      setIsNativeSessionBusy(false);
    }
  }, [currentFilePath, currentUrl, nativeSessionState?.url, setBridgeSession, setBridgeStatus]);


  const handleNativeRefreshState = useCallback(async () => {
    const sessionId = nativeSessionIdRef.current ?? sessionIdRef.current;
    setIsNativeSessionBusy(true);
    try {
      const state = await browserBridgeService.getNativeWindowsState(sessionId);
      nativeSessionIdRef.current = state.sessionId;
      const meta = buildSessionMeta({
        mode: 'externalNativeControlled',
        sourceType,
        currentUrl: state.url ?? currentUrl,
        currentFilePath,
      });
      setNativeSessionState(state);
      setBridgeSession(state.sessionId, state.status, meta);
      setBridgeStatus(state.status, state.error ?? null, state.errorCode ?? null, meta);
    } catch (error) {
      logger.error('[BrowserPanel] Failed to refresh native browser session state', error);
    } finally {
      setIsNativeSessionBusy(false);
    }
  }, [currentFilePath, currentUrl, setBridgeSession, setBridgeStatus, sourceType]);

  const nativeStatusTone =
    nativeSessionState?.status === 'ready'
      ? 'default'
      : nativeSessionState?.status === 'failed'
        ? 'destructive'
        : 'secondary';


  const isLocalhostPreview = sourceType === 'url' && !!currentUrl && isLocalhostUrl(currentUrl);
  const canUsePicker =
    (sourceType === 'file' && isHtmlLikeFile(currentFilePath) && !!currentContent) ||
    (isLocalhostPreview && !!localhostDocument);

  const filePreviewDocument = useMemo(
    () => buildFilePreviewDocument(currentContent, currentFilePath, sessionIdRef.current),
    [currentContent, currentFilePath, refreshKey]
  );

  const sourceLabel = currentFilePath || currentUrl || t.RepositoryLayout.browserEmptyState;

  const handleSubmit = () => {
    const normalizedUrl = normalizeUrl(addressInput);
    if (!normalizedUrl) return;
    onOpenUrl(normalizedUrl);
  };

  const handleRefresh = () => {
    if (sourceType === 'file') {
      rotateSession('fileControlled', 'loading');
      setRefreshKey((k) => k + 1);
      return;
    }

    if (sourceType === 'url' && isLocalhostUrl(currentUrl)) {
      rotateSession('localhostControlled', 'loading');
      setRefreshKey((k) => k + 1);
      void (async () => {
        try {
          const response = await simpleFetch(currentUrl, {
            method: 'GET',
            headers: { 'x-talkcody-allow-private-ip': 'true' },
          });
          const html = await response.text();
          setLocalhostDocument(buildHtmlDocument(html, sessionIdRef.current, currentUrl));
        } catch (error) {
          logger.error('[BrowserPanel] Failed to refresh localhost preview', error);
          setLocalhostError(error instanceof Error ? error.message : String(error));
          setBridgeStatus(
            'error',
            error instanceof Error ? error.message : String(error),
            'COMMAND_FAILED'
          );
        }
      })();
      return;
    }

    if (sourceType === 'url' && iframeRef.current?.src) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      iframeRef.current.src = currentSrc;
    }
  };

  const handleOpenDevtools = async () => {
    try {
      await invoke('open_current_window_devtools');
    } catch {
      toast.error(t.RepositoryLayout.openDevtoolsFailed);
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
    if (sourceType === 'url' && !isLocalhostUrl(currentUrl)) {
      setBridgeStatus(
        'ready',
        null,
        null,
        buildSessionMeta({
          mode: getUncontrolledMode(sourceType, currentUrl),
          sourceType,
          currentUrl,
          currentFilePath,
        })
      );
    }
    if (isPickerActive) {
      sendPickerMessage('activate');
    }
  };

  const renderFrame = () => {
    if (isLocalhostPreview && localhostDocument) {
      return (
        <iframe
          key={refreshKey}
          ref={iframeRef}
          className="h-full w-full bg-white"
          srcDoc={localhostDocument}
          title="Project browser localhost preview"
          onLoad={handleIframeLoad}
        />
      );
    }

    if (isLocalhostPreview && localhostError) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {localhostError}
        </div>
      );
    }

    if (sourceType === 'url' && currentUrl) {
      return (
        <iframe
          ref={iframeRef}
          className="h-full w-full bg-white"
          src={currentUrl}
          title={isLocalhostPreview ? 'Project browser localhost preview' : 'Project browser'}
          onLoad={handleIframeLoad}
        />
      );
    }

    if (filePreviewDocument) {
      return (
        <iframe
          key={refreshKey}
          ref={iframeRef}
          className="h-full w-full bg-white"
          srcDoc={filePreviewDocument}
          title="Project browser"
          onLoad={handleIframeLoad}
        />
      );
    }

    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {t.RepositoryLayout.browserEmptyState}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-l bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{t.RepositoryLayout.browserPanelTitle}</div>
          <div className="truncate text-xs text-muted-foreground">{sourceLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Input
          value={addressInput}
          onChange={(event) => setAddressInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSubmit();
            }
          }}
          placeholder={t.RepositoryLayout.browserAddressPlaceholder}
        />
        <Button size="sm" onClick={handleSubmit}>
          {t.RepositoryLayout.openBrowser}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.RepositoryLayout.refreshBrowser}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={handleOpenDevtools}>
              <CodeXml className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.RepositoryLayout.openDevtools}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant={isPickerActive ? 'default' : 'ghost'} onClick={handleTogglePicker}>
              <MousePointerClick className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isPickerActive
              ? t.RepositoryLayout.stylePickerActiveHint
              : t.RepositoryLayout.stylePickerActivate}
          </TooltipContent>
        </Tooltip>
        {onClose ? (
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t.RepositoryLayout.closeBrowser}
          </Button>
        ) : null}
      </div>

      {nativeModeEnabled ? (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
          <Badge variant={nativeStatusTone}>{nativeSessionState?.status ?? 'initializing'}</Badge>
          <Badge variant="outline">external-native-controlled</Badge>
          <Badge variant="outline">windows-webview2</Badge>
          <span className="truncate text-muted-foreground">{nativeSessionState?.url ?? currentUrl}</span>
          {nativeSessionState?.title ? (
            <span className="truncate text-muted-foreground">title: {nativeSessionState.title}</span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleNativeRefreshState} disabled={isNativeSessionBusy}>
              <MonitorUp className="mr-1 h-4 w-4" />
              Refresh State
            </Button>
            <Button size="sm" variant="outline" onClick={handleNativeClose} disabled={isNativeSessionBusy}>
              <X className="mr-1 h-4 w-4" />
              Close Native
            </Button>
          </div>
          {nativeSessionState?.error ? (
            <div className="w-full text-destructive">
              {nativeSessionState.errorCode ? `${nativeSessionState.errorCode}: ` : ''}
              {nativeSessionState.error}
            </div>
          ) : null}
        </div>
      ) : null}

      {isPickerActive ? (
        <div className="border-b bg-primary/5 px-3 py-2 text-xs text-primary">
          {t.RepositoryLayout.stylePickerActiveHint}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">{renderFrame()}</div>
    </div>
  );
}
