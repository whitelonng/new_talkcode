export interface FindWidgetTooltipEditor {
  getDomNode: () => HTMLElement | null;
  getAction: (id: string) => { tooltip?: string; label?: string } | null;
}

export interface FindWidgetTooltipSuppressor {
  apply: () => void;
  dispose: () => void;
}

const TOOLTIP_ACTIONS = [
  'editor.action.findAgain',
  'editor.action.findNextMatch',
  'editor.action.findPreviousMatch',
  'closeFindWidgetCommand',
];

const TOOLTIP_ATTRIBUTE_SELECTOR =
  '[title], [aria-label], [data-hover], [data-tooltip], [data-title]';

function isFindWidgetOpen(findWidget: HTMLElement): boolean {
  if (findWidget.classList.contains('hidden')) {
    return false;
  }

  if (findWidget.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  const style = (findWidget.getAttribute('style') || '').toLowerCase();
  if (style.includes('display: none') || style.includes('visibility: hidden')) {
    return false;
  }

  return true;
}

function hideTooltipNode(node: HTMLElement) {
  node.style.display = 'none';
  node.style.pointerEvents = 'none';
  node.style.opacity = '0';
  node.setAttribute('data-find-widget-tooltip-blocked', 'true');
}

function hideTooltipNodes(container: ParentNode) {
  const tooltipNodes = container.querySelectorAll('.monaco-hover, .context-view');
  for (const node of tooltipNodes) {
    if (node instanceof HTMLElement) {
      hideTooltipNode(node);
    }
  }
}

export function setupFindWidgetTooltipSuppression({
  editor,
  documentRef = document,
}: {
  editor: FindWidgetTooltipEditor;
  documentRef?: Document;
}): FindWidgetTooltipSuppressor {
  const getFindWidgets = () =>
    Array.from(documentRef.querySelectorAll('.find-widget')) as HTMLElement[];

  const updateBodyClass = (open: boolean) => {
    const body = documentRef.body;
    if (!body) {
      return;
    }

    if (open) {
      body.classList.add('find-widget-open');
    } else {
      body.classList.remove('find-widget-open');
    }
  };

  const clearActionTooltips = () => {
    for (const actionId of TOOLTIP_ACTIONS) {
      const action = editor.getAction(actionId);
      if (action) {
        action.tooltip = '';
        action.label = '';
      }
    }
  };

  const removeTooltipAttributes = (widget: HTMLElement) => {
    const elements = widget.querySelectorAll(TOOLTIP_ATTRIBUTE_SELECTOR);
    for (const element of elements) {
      element.removeAttribute('title');
      element.removeAttribute('aria-label');
      element.removeAttribute('data-hover');
      element.removeAttribute('data-tooltip');
      element.removeAttribute('data-title');
    }
  };

  const apply = () => {
    clearActionTooltips();

    const findWidgets = getFindWidgets();
    const anyOpen = findWidgets.some((widget) => isFindWidgetOpen(widget));
    const editorDom = editor.getDomNode();

    for (const widget of findWidgets) {
      removeTooltipAttributes(widget);
    }
    updateBodyClass(anyOpen);

    if (editorDom) {
      if (anyOpen) {
        editorDom.classList.add('find-widget-open');
      } else {
        editorDom.classList.remove('find-widget-open');
      }
    }

    if (anyOpen && documentRef.body) {
      hideTooltipNodes(documentRef.body);
    }
  };

  if (!documentRef.body || typeof MutationObserver === 'undefined') {
    return {
      apply,
      dispose: () => {},
    };
  }

  const observer = new MutationObserver((mutations) => {
    const findWidgets = getFindWidgets();
    const anyOpen = findWidgets.some((widget) => isFindWidgetOpen(widget));
    updateBodyClass(anyOpen);

    if (!anyOpen) {
      return;
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.classList.contains('monaco-hover') || node.classList.contains('context-view')) {
            // Hide the node itself
            hideTooltipNode(node);
            // Also hide any nested tooltip nodes within it
            hideTooltipNodes(node);
          } else {
            hideTooltipNodes(node);
          }
        }
      }
    }
  });

  observer.observe(documentRef.body, {
    childList: true,
    subtree: true,
  });

  return {
    apply,
    dispose: () => {
      updateBodyClass(false);
      observer.disconnect();
    },
  };
}
