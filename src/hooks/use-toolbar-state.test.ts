import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalAgentBackend } from '@/types';
import type { Task } from '@/types/task';
import { useToolbarState } from './use-toolbar-state';

const {
  mockTaskStoreState,
  mockUseTaskStore,
  mockSettingsStoreState,
  mockUseSettingsStore,
  mockProviderStoreState,
  mockUseProviderStore,
  setTask,
} = vi.hoisted(() => {
  const mockTaskStoreState = {
    currentTaskId: 'task-1',
    getTask: vi.fn(),
  };
  const mockUseTaskStore = (selector: (state: typeof mockTaskStoreState) => unknown) =>
    selector(mockTaskStoreState);

  const mockSettingsStoreState = {
    model_type_main: 'main',
    model_type_small: 'small',
    model_type_image_generator: 'image',
    model_type_transcription: 'transcription',
    assistantId: 'assistant',
  };
  const mockUseSettingsStore = (
    selector: (state: typeof mockSettingsStoreState) => unknown
  ) => selector(mockSettingsStoreState);

  const mockProviderStoreState = {
    availableModels: [
      {
        key: 'gpt',
        name: 'GPT',
        provider: 'openai',
        providerName: 'OpenAI',
        imageInput: false,
        imageOutput: false,
        audioInput: false,
      },
    ],
  };
  const mockUseProviderStore = (
    selector: (state: typeof mockProviderStoreState) => unknown
  ) => selector(mockProviderStoreState);

  const setTask = (task: Task | undefined) => {
    mockTaskStoreState.getTask.mockReturnValue(task);
  };

  return {
    mockTaskStoreState,
    mockUseTaskStore,
    mockSettingsStoreState,
    mockUseSettingsStore,
    mockProviderStoreState,
    mockUseProviderStore,
    setTask,
  };
});

vi.mock('@/stores/task-store', () => ({
  useTaskStore: mockUseTaskStore,
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: mockUseSettingsStore,
}));

vi.mock('@/providers/stores/provider-store', () => ({
  useProviderStore: mockUseProviderStore,
  modelService: {
    getCurrentModel: vi.fn().mockResolvedValue('gpt@openai'),
  },
}));

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Task 1',
  project_id: 'project-1',
  created_at: 1,
  updated_at: 1,
  message_count: 0,
  request_count: 0,
  cost: 0,
  input_token: 0,
  output_token: 0,
  model: 'gpt@openai',
  ...overrides,
});

describe('useToolbarState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskStoreState.currentTaskId = 'task-1';
    mockSettingsStoreState.assistantId = 'assistant';
    mockProviderStoreState.availableModels = mockProviderStoreState.availableModels.slice(0, 1);
  });

  it('uses last_request_input_token when present', () => {
    setTask(
      createTask({
        input_token: 300,
        last_request_input_token: 42,
      })
    );

    const { result } = renderHook(() => useToolbarState());

    expect(result.current.inputTokens).toBe(42);
  });

  it('shows backend name only for codex and claude tasks', async () => {
    setTask(
      createTask({
        backend: 'codex' satisfies ExternalAgentBackend,
        model: 'claude-opus-4-6@claude',
      })
    );

    const { result, rerender } = renderHook(() => useToolbarState());

    await waitFor(() => {
      expect(result.current.modelName).toBe('codex');
    });

    setTask(
      createTask({
        backend: 'claude' satisfies ExternalAgentBackend,
        model: 'claude-opus-4-6@claude',
      })
    );
    rerender();

    await waitFor(() => {
      expect(result.current.modelName).toBe('claude');
    });
  });

  it('shows full model and provider for talkcody tasks', async () => {
    setTask(
      createTask({
        backend: 'native' satisfies ExternalAgentBackend,
        model: 'gpt@openai',
      })
    );

    const { result } = renderHook(() => useToolbarState());

    await waitFor(() => {
      expect(result.current.modelName).toBe('GPT@OpenAI');
    });
  });
});
