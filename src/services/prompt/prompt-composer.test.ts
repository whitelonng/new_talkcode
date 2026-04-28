import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AgentDefinition } from '@/types/agent';
import { ModelType } from '@/types/model-types';
import type { PromptContextProvider } from '@/types/prompt';
import type { ToolWithUI } from '@/types/tool';

const hoisted = vi.hoisted(() => {
  const getBrowserSnapshotMock = vi.fn(() => ({
    isBrowserVisible: true,
    sourceType: 'url',
    currentUrl: 'http://localhost:3000/login',
    currentFilePath: null,
    bridgeMode: 'localhostControlled',
    bridgeStatus: 'ready',
    bridgeCapabilities: {
      navigation: true,
      domControl: true,
      scriptExecution: true,
      consoleCapture: true,
      domRead: true,
      domWrite: true,
      scriptEval: true,
      consoleRead: true,
      networkObserve: true,
      screenshot: false,
      keyboardInput: true,
      mouseInput: true,
      externalControl: false,
    },
    bridgeSessionMeta: {
      mode: 'localhostControlled',
      sourceType: 'url',
      platform: 'web',
      url: 'http://localhost:3000/login',
      filePath: null,
      isExternalPage: false,
      supportsNativeHost: false,
      capabilitySet: {
        navigation: 'available',
        domRead: 'available',
        domWrite: 'available',
        scriptEval: 'available',
        consoleRead: 'available',
        networkObserve: 'partial',
        screenshot: 'unavailable',
        keyboardInput: 'available',
        mouseInput: 'available',
        externalControl: 'unavailable',
      },
    },
    bridgeErrorCode: null,
    pendingCommandId: null,
    lastBridgeResult: null,
    consoleEntries: [],
    networkEntries: [],
    bridgeError: null,
  }));

  return {
    mockLogger: {
      warn: vi.fn(),
    },
    getBrowserSnapshotMock,
  };
});

const { mockLogger, getBrowserSnapshotMock } = hoisted;

vi.mock('@/lib/logger', () => ({
  logger: hoisted.mockLogger,
}));

vi.mock('@/services/repository-service', () => ({
  repositoryService: {
    readFile: vi.fn(),
  },
}));

vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getSync: vi.fn(() => 'en'),
  },
}));

vi.mock('@/services/browser-bridge-service', () => ({
  browserBridgeService: {
    getSnapshot: hoisted.getBrowserSnapshotMock,
  },
}));

import { PromptComposer } from './prompt-composer';

function createAgent(): AgentDefinition {
  return {
    id: 'agent-1',
    name: 'Agent One',
    modelType: ModelType.MAIN,
    systemPrompt: 'Base system prompt',
    dynamicPrompt: {
      enabled: true,
      providers: ['task_summary', 'skills'],
      variables: {},
    },
  };
}

function createToolStub(name: string, description: string): ToolWithUI {
  return {
    name,
    description,
    inputSchema: z.object({}),
    execute: async () => ({}),
    renderToolDoing: () => null,
    renderToolResult: () => null,
    canConcurrent: true,
  };
}

describe('PromptComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps composing when one auto-injected provider throws', async () => {
    const failingProvider: PromptContextProvider = {
      id: 'task_summary',
      label: 'Task Summary',
      description: 'Loads task summary context',
      providedTokens() {
        return ['task_summary'];
      },
      canResolve(token: string) {
        return token === 'task_summary';
      },
      async resolve() {
        throw new Error('Workspace root is unavailable');
      },
      injection: {
        enabledByDefault: true,
        placement: 'append',
        sectionTitle: 'Task Summary',
        sectionTemplate(values: Record<string, string>) {
          const content = values.task_summary || '';
          return content ? `## Task Summary\n\n${content}` : '';
        },
      },
    };

    const workingProvider: PromptContextProvider = {
      id: 'skills',
      label: 'Skills',
      description: 'Loads skill instructions',
      providedTokens() {
        return ['skills'];
      },
      canResolve(token: string) {
        return token === 'skills';
      },
      async resolve() {
        return '- Use bun run test';
      },
      injection: {
        enabledByDefault: true,
        placement: 'append',
        sectionTitle: 'Skills',
        sectionTemplate(values: Record<string, string>) {
          const content = values.skills || '';
          return content ? `## Skills\n\n${content}` : '';
        },
      },
    };

    const composer = new PromptComposer([failingProvider, workingProvider]);

    const result = await composer.compose({
      agent: createAgent(),
      workspaceRoot: '/repo',
      taskId: 'stale-task',
    });

    expect(result.finalSystemPrompt).toContain('Base system prompt');
    expect(result.finalSystemPrompt).toContain('## Skills');
    expect(result.finalSystemPrompt).toContain('- Use bun run test');
    expect(result.finalSystemPrompt).not.toContain('## Task Summary');
    expect(result.resolvedContextSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: 'skills',
          token: 'skills',
          charsInjected: expect.any(Number),
        }),
      ])
    );
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('injects shared memory tool activation guidance when memory tools are available', async () => {
    const composer = new PromptComposer([]);

    const result = await composer.compose({
      agent: {
        ...createAgent(),
        tools: {
          memoryRead: createToolStub('memoryRead', 'Read memory'),
          memoryWrite: createToolStub('memoryWrite', 'Write memory'),
        },
      },
      workspaceRoot: '/repo',
    });

    expect(result.finalSystemPrompt).toContain('## Tool Activation Guidance');
    expect(result.finalSystemPrompt).toContain('proactively consider using `memoryRead`');
    expect(result.finalSystemPrompt).toContain('proactively consider using `memoryWrite`');
    expect(result.finalSystemPrompt).toContain('first 200 lines of MEMORY.md');
    expect(result.finalSystemPrompt).toContain('Treat that content as an index');
    expect(result.finalSystemPrompt).toContain('read the referenced topic file before answering');
    expect(result.finalSystemPrompt).toContain('Avoid duplicate memory');
    expect(result.finalSystemPrompt).toContain('organize topics by stable subject');
    expect(result.finalSystemPrompt).toContain(
      'Follow the memory tools\' own rules for scope selection, durability, and error handling.'
    );
  });

  it('injects auto-memory guidance that forbids inferring topic contents from MEMORY.md alone', async () => {
    const composer = new PromptComposer([]);

    const result = await composer.compose({
      agent: {
        ...createAgent(),
        dynamicPrompt: {
          enabled: true,
          providers: ['global_memory'],
          variables: {},
        },
      },
      workspaceRoot: '/repo',
    });

    expect(result.finalSystemPrompt).toContain('Auto memory guidance:');
    expect(result.finalSystemPrompt).toContain('Start with the injected MEMORY.md lines.');
    expect(result.finalSystemPrompt).toContain('read the full MEMORY.md before concluding the memory is missing');
    expect(result.finalSystemPrompt).toContain(
      'Treat MEMORY.md as a routing index, not the detailed memory payload.'
    );
    expect(result.finalSystemPrompt).toContain(
      'Never claim that you know a topic file\'s contents unless you have actually read that topic file.'
    );
    expect(result.finalSystemPrompt).toContain('keep each topic focused on one stable subject');
    expect(result.finalSystemPrompt).toContain('avoid writing duplicate topic routes or duplicate memory facts');
  });

  it('injects browser control runtime guidance when browser tools are available', async () => {
    const composer = new PromptComposer([]);

    const result = await composer.compose({
      agent: {
        ...createAgent(),
        tools: {
          browserControl: createToolStub('browserControl', 'Browser control toggle'),
          browserNavigate: createToolStub('browserNavigate', 'Navigate browser'),
          browserSnapshot: createToolStub('browserSnapshot', 'Snapshot browser'),
        },
      },
      workspaceRoot: '/repo',
    });

    expect(result.finalSystemPrompt).toContain('Browser Control Runtime Context:');
    expect(result.finalSystemPrompt).toContain('- browserOpen: true');
    expect(result.finalSystemPrompt).toContain('- mode: localhostControlled');
    expect(result.finalSystemPrompt).toContain('- target: http://localhost:3000/login');
    expect(result.finalSystemPrompt).toContain('Browser Control Operating Rules:');
    expect(result.finalSystemPrompt).toContain('Default browser workflow: read the page before taking actions.');
    expect(result.finalSystemPrompt).toContain('Start with browserGetPageState to confirm url, title, loading state, and high-level page status.');
    expect(result.finalSystemPrompt).toContain('Then call browserSnapshot to capture the visible content and current DOM-derived page text.');
    expect(result.finalSystemPrompt).toContain('Then call browserListInteractiveElements to enumerate actionable controls before choosing selectors or element ids.');
    expect(result.finalSystemPrompt).toContain('Do not click, type, submit, scroll, or execute scripts until you have completed the read-first sequence');
    expect(result.finalSystemPrompt).toContain('The current browser session is ready for the read-first workflow now.');
    expect(result.finalSystemPrompt).toContain('DOM read capability is available, so rely on browserGetPageState, browserSnapshot, and browserListInteractiveElements as the primary grounding source.');
    expect(result.finalSystemPrompt).toContain('Current page mode is suitable for the minimum controllable browser workflow.');
  });

  it('does not inject browser control runtime guidance when browser tools are unavailable', async () => {
    const composer = new PromptComposer([]);

    const result = await composer.compose({
      agent: createAgent(),
      workspaceRoot: '/repo',
    });

    expect(result.finalSystemPrompt).not.toContain('Browser Control Runtime Context:');
    expect(result.finalSystemPrompt).not.toContain('Browser Control Operating Rules:');
  });

  it('warns when the browser session is not ready for the read-first workflow', async () => {
    getBrowserSnapshotMock.mockReturnValueOnce({
      ...getBrowserSnapshotMock(),
      isBrowserVisible: false,
      bridgeStatus: 'loading',
      bridgeError: 'navigation in progress',
    });

    const composer = new PromptComposer([]);
    const result = await composer.compose({
      agent: {
        ...createAgent(),
        tools: {
          browserNavigate: createToolStub('browserNavigate', 'Navigate browser'),
          browserSnapshot: createToolStub('browserSnapshot', 'Snapshot browser'),
        },
      },
      workspaceRoot: '/repo',
    });

    expect(result.finalSystemPrompt).toContain(
      'The current browser session is not yet ready for the read-first workflow. Stabilize the page first, then inspect it before acting.'
    );
  });

  it('warns about non-mvp browser modes when browser tools are available', async () => {
    getBrowserSnapshotMock.mockReturnValueOnce({
      ...getBrowserSnapshotMock(),
      sourceType: 'url',
      currentUrl: 'https://example.com',
      bridgeMode: 'externalEmbedded',
      bridgeStatus: 'ready',
      bridgeSessionMeta: {
        mode: 'externalEmbedded',
        sourceType: 'url',
        platform: 'web',
        url: 'https://example.com',
        filePath: null,
        isExternalPage: true,
        supportsNativeHost: false,
        capabilitySet: {
          navigation: 'available',
          domRead: 'partial',
          domWrite: 'unavailable',
          scriptEval: 'unavailable',
          consoleRead: 'unavailable',
          networkObserve: 'unavailable',
          screenshot: 'unavailable',
          keyboardInput: 'partial',
          mouseInput: 'partial',
          externalControl: 'partial',
        },
      },
    });

    const composer = new PromptComposer([]);
    const result = await composer.compose({
      agent: {
        ...createAgent(),
        tools: {
          browserNavigate: createToolStub('browserNavigate', 'Navigate browser'),
          browserSnapshot: createToolStub('browserSnapshot', 'Snapshot browser'),
        },
      },
      workspaceRoot: '/repo',
    });

    expect(result.finalSystemPrompt).toContain('Current page mode is not the preferred MVP controllable path.');
  });

  it('does not inject shared memory guidance when memory tools are unavailable', async () => {
    const composer = new PromptComposer([]);

    const result = await composer.compose({
      agent: createAgent(),
      workspaceRoot: '/repo',
    });

    expect(result.finalSystemPrompt).not.toContain('## Tool Activation Guidance');
    expect(result.finalSystemPrompt).not.toContain('proactively consider using `memoryRead`');
    expect(result.finalSystemPrompt).not.toContain('proactively consider using `memoryWrite`');
  });
});
