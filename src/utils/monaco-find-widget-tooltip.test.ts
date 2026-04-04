import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupFindWidgetTooltipSuppression } from './monaco-find-widget-tooltip';

describe('monaco find widget tooltip suppression', () => {
  afterEach(() => {
    document.body.className = '';
    document.body.innerHTML = '';
  });

  it('removes tooltip attributes and toggles find-widget-open class', () => {
    const root = document.createElement('div');
    root.className = 'monaco-editor';

    const findWidget = document.createElement('div');
    findWidget.className = 'find-widget visible';

    const closeButton = document.createElement('button');
    closeButton.setAttribute('title', 'Close');
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.setAttribute('data-hover', 'Close');
    closeButton.setAttribute('data-tooltip', 'Close');
    closeButton.setAttribute('data-title', 'Close');

    findWidget.appendChild(closeButton);
    root.appendChild(findWidget);
    document.body.appendChild(root);

    const actions = new Map<string, { tooltip?: string; label?: string }>();
    actions.set('closeFindWidgetCommand', { tooltip: 'Close', label: 'Close' });

    const suppressor = setupFindWidgetTooltipSuppression({
      editor: {
        getDomNode: () => root,
        getAction: (id: string) => actions.get(id) ?? null,
      },
      documentRef: document,
    });

    suppressor.apply();

    expect(closeButton.hasAttribute('title')).toBe(false);
    expect(closeButton.hasAttribute('aria-label')).toBe(false);
    expect(closeButton.hasAttribute('data-hover')).toBe(false);
    expect(closeButton.hasAttribute('data-tooltip')).toBe(false);
    expect(closeButton.hasAttribute('data-title')).toBe(false);
    expect(document.body.classList.contains('find-widget-open')).toBe(true);

    const action = actions.get('closeFindWidgetCommand');
    expect(action?.tooltip).toBe('');
    expect(action?.label).toBe('');

    findWidget.style.display = 'none';
    suppressor.apply();
    expect(document.body.classList.contains('find-widget-open')).toBe(false);

    suppressor.dispose();
  });

  it('hides tooltip nodes when find widget is open', async () => {
    const root = document.createElement('div');
    root.className = 'monaco-editor';

    const findWidget = document.createElement('div');
    findWidget.className = 'find-widget visible';
    root.appendChild(findWidget);
    document.body.appendChild(root);

    const suppressor = setupFindWidgetTooltipSuppression({
      editor: {
        getDomNode: () => root,
        getAction: () => null,
      },
      documentRef: document,
    });

    suppressor.apply();

    const contextView = document.createElement('div');
    contextView.className = 'context-view';

    const hover = document.createElement('div');
    hover.className = 'monaco-hover';
    hover.textContent = 'Close (Escape)';

    contextView.appendChild(hover);
    document.body.appendChild(contextView);

    // Wait for MutationObserver to process the added nodes
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(contextView.style.display).toBe('none');
    expect(hover.style.display).toBe('none');

    suppressor.dispose();
  });
});
