import { getToolSync } from '@/lib/tools';
import type { AgentDefinition } from '@/types/agent';
import { ModelType } from '@/types/model-types';

const BrowserControlPrompt = `
# Role & Identity

You are the Browser Control agent. Your primary responsibility is to operate the browser with precision for inspection, interaction, debugging, validation, and workflow automation.

You specialize in:
- Navigating pages and validating page state
- Inspecting DOM structure and interactive elements
- Performing reliable user-like interactions
- Reading console errors and network activity
- Executing targeted in-page scripts for diagnosis
- Reproducing UI issues and verifying fixes

## Core Working Principles

1. Prefer stable, observable actions over brittle assumptions.
2. Inspect before acting when the page state is unclear.
3. Use browser snapshots, element queries, console, and network logs to validate every important step.
4. If a task also requires code changes, clearly report findings so another implementation agent can act on them.
5. Keep actions minimal, deterministic, and reversible when possible.

## Recommended Workflow

1. Understand the page goal.
2. Navigate to the page and wait for stable state.
3. Inspect interactive elements or DOM structure if selectors are uncertain.
4. Perform interactions step by step.
5. Verify outcomes through page state, console, network logs, or visible UI.
6. Summarize findings, blockers, and evidence clearly.

## Tool Strategy

- Batch related read/inspection tool calls whenever possible.
- Use snapshots and element discovery before risky actions.
- Use network and console tools proactively during debugging.
- Use script execution only when direct browser tools are insufficient.

## Boundaries

- You are optimized for browser control and web interaction tasks.
- You may read TalkCody memory when relevant.
- You may maintain a todo list for multi-step browser tasks.
- You are not the primary code modification agent.
- If the task expands into implementation work, report the browser findings clearly for handoff.

## Output Expectations

- Be concise and action-oriented.
- Report what was attempted, what was observed, and whether the goal was achieved.
- When blocked, state the exact blocker and the evidence.
`;

export class BrowserControlAgent {
  private constructor() {}

  static readonly VERSION = '1.0.0';

  static getDefinition(): AgentDefinition {
    const selectedTools = {
      memoryRead: getToolSync('memoryRead'),
      memoryWrite: getToolSync('memoryWrite'),
      todoWrite: getToolSync('todoWrite'),
      browserNavigate: getToolSync('browserNavigate'),
      browserClick: getToolSync('browserClick'),
      browserClickByText: getToolSync('browserClickByText'),
      browserType: getToolSync('browserType'),
      browserFillForm: getToolSync('browserFillForm'),
      browserExecuteScript: getToolSync('browserExecuteScript'),
      browserSnapshot: getToolSync('browserSnapshot'),
      browserWaitFor: getToolSync('browserWaitFor'),
      browserScroll: getToolSync('browserScroll'),
      browserGetConsole: getToolSync('browserGetConsole'),
      browserHighlightElement: getToolSync('browserHighlightElement'),
      browserListInteractiveElements: getToolSync('browserListInteractiveElements'),
      browserGetElementInfo: getToolSync('browserGetElementInfo'),
      browserPressKey: getToolSync('browserPressKey'),
      browserClearConsole: getToolSync('browserClearConsole'),
      browserEvaluateExpression: getToolSync('browserEvaluateExpression'),
      browserGetConsoleErrors: getToolSync('browserGetConsoleErrors'),
      browserGetNetworkLogs: getToolSync('browserGetNetworkLogs'),
      browserFindNetworkRequest: getToolSync('browserFindNetworkRequest'),
      browserGetRequestDetail: getToolSync('browserGetRequestDetail'),
      browserClearNetworkLogs: getToolSync('browserClearNetworkLogs'),
      browserGetPageState: getToolSync('browserGetPageState'),
      browserWaitForNavigation: getToolSync('browserWaitForNavigation'),
      browserWaitForText: getToolSync('browserWaitForText'),
      browserWaitForElementState: getToolSync('browserWaitForElementState'),
      browserQueryElements: getToolSync('browserQueryElements'),
      browserGetDomTree: getToolSync('browserGetDomTree'),
      browserFocus: getToolSync('browserFocus'),
      browserBlur: getToolSync('browserBlur'),
      browserHover: getToolSync('browserHover'),
      browserSelectOption: getToolSync('browserSelectOption'),
      browserCheck: getToolSync('browserCheck'),
      browserUncheck: getToolSync('browserUncheck'),
    };

    return {
      id: 'browser-control',
      name: '浏览器控制',
      description: 'Specialized browser automation agent for interaction, inspection, debugging, and validation',
      modelType: ModelType.MAIN,
      hidden: false,
      isDefault: true,
      version: BrowserControlAgent.VERSION,
      defaultSkills: [
        'talkcody-knowledge-base',
        'webapp-testing',
        'systematic-debugging',
        'verification-before-completion',
      ],
      systemPrompt: BrowserControlPrompt,
      tools: selectedTools,
      role: 'write',
      canBeSubagent: true,
      dynamicPrompt: {
        enabled: true,
        providers: [
          'env',
          'global_memory',
          'project_memory',
          'agents_md',
          'output_format',
          'skills',
        ],
        variables: {},
      },
    };
  }
}
