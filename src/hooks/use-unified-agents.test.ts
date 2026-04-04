import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent } from '@/types';
import { useUnifiedAgents } from './use-unified-agents';

const {
  refreshAgentsMock,
  listAgentsMock,
  registryListMock,
  registryIsEnabledMock,
  mockUseAgentStore,
} = vi.hoisted(() => {
  const refreshAgentsMock = vi.fn();
  const listAgentsMock = vi.fn();
  const registryListMock = vi.fn();
  const registryIsEnabledMock = vi.fn();
  const mockAgentStoreState = {
    agents: new Map(),
    refreshAgents: refreshAgentsMock,
  };
  const mockUseAgentStore = Object.assign(
    (selector: (state: typeof mockAgentStoreState) => unknown) => selector(mockAgentStoreState),
    {
      getState: () => mockAgentStoreState,
    }
  );

  return {
    refreshAgentsMock,
    listAgentsMock,
    registryListMock,
    registryIsEnabledMock,
    mockUseAgentStore,
  };
});

vi.mock('@/stores/agent-store', () => ({
  useAgentStore: mockUseAgentStore,
}));

vi.mock('@/services/database/agent-service', () => ({
  agentService: {
    listAgents: listAgentsMock,
  },
}));

vi.mock('@/services/agents/agent-registry', () => ({
  agentRegistry: {
    list: registryListMock,
    isSystemAgentEnabled: registryIsEnabledMock,
  },
}));

vi.mock('./use-marketplace', () => ({
  useMarketplace: () => ({
    agents: [],
    categories: [],
    tags: [],
    featuredAgents: [],
    isLoading: false,
    error: null,
    loadAgents: vi.fn(),
    loadCategories: vi.fn(),
    loadTags: vi.fn(),
    loadFeaturedAgents: vi.fn(),
    getAgentBySlug: vi.fn(),
    installAgent: vi.fn(),
  }),
}));

const systemAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: 'system-agent',
  name: 'System Agent',
  description: 'System agent',
  model_type: 'main_model',
  system_prompt: 'system prompt',
  tools_config: '{}',
  rules: '',
  output_format: '',
  is_hidden: false,
  is_default: true,
  is_enabled: true,
  source_type: 'system',
  is_shared: false,
  created_at: 1,
  updated_at: 1,
  created_by: 'system',
  usage_count: 0,
  categories: '[]',
  tags: '[]',
  ...overrides,
});

describe('useUnifiedAgents', () => {
  beforeEach(() => {
    refreshAgentsMock.mockClear();
    listAgentsMock.mockReset();
    registryListMock.mockReset();
    registryIsEnabledMock.mockReset();
  });

  it('uses registry data for system agents when refreshing local agents', async () => {
    const registryAgent = {
      id: 'system-1',
      name: 'System One',
      description: 'system',
      modelType: 'main_model',
      systemPrompt: 'prompt',
      tools: {},
      hidden: false,
      rules: '',
      outputFormat: '',
      isDefault: true,
    };

    registryListMock.mockReturnValue([registryAgent]);
    registryIsEnabledMock.mockReturnValue(true);
    listAgentsMock.mockResolvedValue([]);
    refreshAgentsMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useUnifiedAgents());

    await act(async () => {
      await result.current.refreshLocalAgents();
    });

    expect(refreshAgentsMock).toHaveBeenCalledTimes(1);
    expect(registryListMock).toHaveBeenCalledTimes(1);
    expect(listAgentsMock).toHaveBeenCalledWith({ includeHidden: false });
    expect(result.current.localAgents).toEqual([
      expect.objectContaining({
        ...systemAgent({
          id: 'system-1',
          name: 'System One',
          description: 'system',
          system_prompt: 'prompt',
          tools_config: JSON.stringify(registryAgent.tools),
          rules: '',
          output_format: '',
        }),
        _type: 'local',
        created_at: expect.any(Number),
        updated_at: expect.any(Number),
      }),
    ]);
  });
});
