import { browserBridgeService } from '@/services/browser-bridge-service';
import { buildMemoryToolActivationGuidance } from '@/services/memory/memory-guidance';
import type { AgentDefinition } from '@/types/agent';
import type { BrowserControlCapabilityState } from '@/types/browser-control';

function hasTool(agent: AgentDefinition, toolName: string): boolean {
  return Boolean(agent.tools && toolName in agent.tools);
}

function hasBrowserControlTools(agent: AgentDefinition): boolean {
  return Boolean(
    hasTool(agent, 'browserControl') ||
      Object.keys(agent.tools ?? {}).some((toolName) => toolName.startsWith('browser'))
  );
}

function formatCapabilityState(value: BrowserControlCapabilityState | undefined): string {
  return value ?? 'unavailable';
}

function buildBrowserControlGuidance(agent: AgentDefinition): string {
  if (!hasBrowserControlTools(agent)) {
    return '';
  }

  const snapshot = browserBridgeService.getSnapshot();
  const sessionMeta = snapshot.bridgeSessionMeta;
  const capabilitySet = sessionMeta.capabilitySet;
  const currentTarget =
    snapshot.sourceType === 'file'
      ? snapshot.currentFilePath || '(no file open)'
      : snapshot.currentUrl || '(no page open)';

  const recommendedMode =
    sessionMeta.mode === 'fileControlled' || sessionMeta.mode === 'localhostControlled';
  const domReadReady = capabilitySet.domRead === 'available';
  const domReadPartial = capabilitySet.domRead === 'partial';
  const interactiveDiscoveryReady =
    capabilitySet.domRead === 'available' || capabilitySet.domRead === 'partial';
  const canPerformReadFirstWorkflow =
    snapshot.isBrowserVisible && snapshot.bridgeStatus === 'ready' && interactiveDiscoveryReady;

  return [
    'Browser Control Runtime Context:',
    `- browserOpen: ${snapshot.isBrowserVisible ? 'true' : 'false'}`,
    `- sourceType: ${snapshot.sourceType}`,
    `- mode: ${sessionMeta.mode}`,
    `- status: ${snapshot.bridgeStatus}`,
    `- target: ${currentTarget}`,
    `- isExternalPage: ${sessionMeta.isExternalPage ? 'true' : 'false'}`,
    `- supportsNativeHost: ${sessionMeta.supportsNativeHost ? 'true' : 'false'}`,
    '- capabilities:',
    `  - navigation: ${formatCapabilityState(capabilitySet.navigation)}`,
    `  - domRead: ${formatCapabilityState(capabilitySet.domRead)}`,
    `  - domWrite: ${formatCapabilityState(capabilitySet.domWrite)}`,
    `  - scriptEval: ${formatCapabilityState(capabilitySet.scriptEval)}`,
    `  - consoleRead: ${formatCapabilityState(capabilitySet.consoleRead)}`,
    `  - networkObserve: ${formatCapabilityState(capabilitySet.networkObserve)}`,
    `  - keyboardInput: ${formatCapabilityState(capabilitySet.keyboardInput)}`,
    `  - mouseInput: ${formatCapabilityState(capabilitySet.mouseInput)}`,
    `- recentConsoleEntries: ${snapshot.consoleEntries.length}`,
    `- recentNetworkEntries: ${snapshot.networkEntries.length}`,
    `- bridgeError: ${snapshot.bridgeError ?? 'none'}`,
    '',
    'Browser Control Operating Rules:',
    '- Treat Browser Control as an active runtime capability, not just a tool list.',
    '- If browserOpen is false and the task needs browser automation, first call browserNavigate or ask the user to open a controllable page.',
    '- Prefer the MVP controllable paths: fileControlled and localhostControlled.',
    '- Default browser workflow: read the page before taking actions.',
    '- Start with browserGetPageState to confirm url, title, loading state, and high-level page status.',
    '- Then call browserSnapshot to capture the visible content and current DOM-derived page text.',
    '- Then call browserListInteractiveElements to enumerate actionable controls before choosing selectors or element ids.',
    '- Do not click, type, submit, scroll, or execute scripts until you have completed the read-first sequence unless the user explicitly asks for a blind action or the page state makes reading impossible.',
    '- If the task is only to understand or summarize the page, stop after the read-first sequence and answer from the observed content.',
    '- If you need actionable targets, call browserListInteractiveElements before guessing selectors.',
    '- After page-changing actions, use browserWaitForNavigation, browserWaitForText, or browserWaitForElementState to confirm completion, then repeat browserGetPageState or browserSnapshot when the page meaning may have changed.',
    '- Use browserGetConsoleErrors and browserGetNetworkLogs for debugging only after reading page state.',
    canPerformReadFirstWorkflow
      ? '- The current browser session is ready for the read-first workflow now.'
      : '- The current browser session is not yet ready for the read-first workflow. Stabilize the page first, then inspect it before acting.',
    domReadReady
      ? '- DOM read capability is available, so rely on browserGetPageState, browserSnapshot, and browserListInteractiveElements as the primary grounding source.'
      : domReadPartial
        ? '- DOM read capability is partial, so prefer read-first inspection but explain uncertainty when page content or controls are incomplete.'
        : '- DOM read capability is unavailable, so do not pretend you can safely interact with unseen page content.',
    recommendedMode
      ? '- Current page mode is suitable for the minimum controllable browser workflow.'
      : '- Current page mode is not the preferred MVP controllable path. If DOM control is unavailable or partial, explain the limitation instead of pretending the page is fully controllable.',
  ].join('\n');
}

export function buildSharedOperationalGuidance(agent: AgentDefinition): string {
  return [
    buildMemoryToolActivationGuidance({
      hasMemoryRead: hasTool(agent, 'memoryRead'),
      hasMemoryWrite: hasTool(agent, 'memoryWrite'),
    }),
    buildBrowserControlGuidance(agent),
  ]
    .filter(Boolean)
    .join('\n\n');
}
