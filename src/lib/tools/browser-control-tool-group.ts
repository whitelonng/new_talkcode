export const BROWSER_CONTROL_TOOL_ID = 'browserControl';

export const BROWSER_CONTROL_SUBTOOLS = [
  'browserNavigate',
  'browserSnapshot',
  'browserClick',
  'browserType',
  'browserExecuteScript',
  'browserWaitFor',
  'browserScroll',
  'browserGetConsole',
  'browserHighlightElement',
  'browserListInteractiveElements',
  'browserGetElementInfo',
  'browserPressKey',
  'browserClearConsole',
  'browserEvaluateExpression',
  'browserGetConsoleErrors',
  'browserGetNetworkLogs',
  'browserFindNetworkRequest',
  'browserGetRequestDetail',
  'browserClearNetworkLogs',
  'browserGetPageState',
  'browserWaitForNavigation',
  'browserWaitForText',
  'browserWaitForElementState',
  'browserQueryElements',
  'browserGetDomTree',
  'browserFocus',
  'browserBlur',
  'browserHover',
  'browserSelectOption',
  'browserCheck',
  'browserUncheck',
] as const;

export type BrowserControlSubToolId = (typeof BROWSER_CONTROL_SUBTOOLS)[number];

export function isBrowserControlToolId(toolId: string): boolean {
  return toolId === BROWSER_CONTROL_TOOL_ID;
}

export function isBrowserControlSubToolId(toolId: string): toolId is BrowserControlSubToolId {
  return (BROWSER_CONTROL_SUBTOOLS as readonly string[]).includes(toolId);
}

export function hasAllBrowserControlSubtools(toolIds: Iterable<string>): boolean {
  const set = toolIds instanceof Set ? toolIds : new Set(toolIds);
  return BROWSER_CONTROL_SUBTOOLS.every((toolId) => set.has(toolId));
}

export function expandBrowserControlToolIds(toolIds: Iterable<string>): string[] {
  const expanded = new Set<string>();
  for (const toolId of toolIds) {
    if (toolId === BROWSER_CONTROL_TOOL_ID) {
      for (const subtoolId of BROWSER_CONTROL_SUBTOOLS) {
        expanded.add(subtoolId);
      }
      continue;
    }
    expanded.add(toolId);
  }
  return Array.from(expanded);
}

export function collapseBrowserControlToolIds(toolIds: Iterable<string>): string[] {
  const set = toolIds instanceof Set ? new Set(toolIds) : new Set(toolIds);
  const hasAll = BROWSER_CONTROL_SUBTOOLS.every((toolId) => set.has(toolId));
  if (!hasAll) {
    return Array.from(set);
  }

  for (const toolId of BROWSER_CONTROL_SUBTOOLS) {
    set.delete(toolId);
  }
  set.add(BROWSER_CONTROL_TOOL_ID);
  return Array.from(set);
}
