import { describe, expect, it } from 'vitest';
import {
  BROWSER_CONTROL_SUBTOOLS,
  collapseBrowserControlToolIds,
  expandBrowserControlToolIds,
} from '@/lib/tools/browser-control-tool-group';

describe('browser-control-tool-group', () => {
  it('expands browserControl to all browser subtools', () => {
    const expanded = expandBrowserControlToolIds(['readFile', 'browserControl']);

    expect(expanded).toContain('readFile');
    for (const toolId of BROWSER_CONTROL_SUBTOOLS) {
      expect(expanded).toContain(toolId);
    }
  });

  it('includes network request inspection subtools', () => {
    expect(BROWSER_CONTROL_SUBTOOLS).toContain('browserFindNetworkRequest');
    expect(BROWSER_CONTROL_SUBTOOLS).toContain('browserGetRequestDetail');
  });

  it('collapses complete browser subtool set into browserControl', () => {
    const collapsed = collapseBrowserControlToolIds(['readFile', ...BROWSER_CONTROL_SUBTOOLS]);

    expect(collapsed).toContain('readFile');
    expect(collapsed).toContain('browserControl');
    for (const toolId of BROWSER_CONTROL_SUBTOOLS) {
      expect(collapsed).not.toContain(toolId);
    }
  });

  it('does not collapse partial browser subtool set', () => {
    const partial = BROWSER_CONTROL_SUBTOOLS.slice(0, 3);
    const collapsed = collapseBrowserControlToolIds(partial);

    expect(collapsed).toEqual(partial);
  });
});
