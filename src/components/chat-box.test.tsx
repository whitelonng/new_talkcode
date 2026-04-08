import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatBox } from './chat-box';

const {
  mockStartExecution,
  mockAddUserMessage,
  mockGetCurrentModel,
  mockGetAgentId,
  mockGetWithResolvedTools,
  mockSetError,
  mockCreateTask,
  mockOnMessageSent,
} = vi.hoisted(() => ({
  mockStartExecution: vi.fn().mockResolvedValue(undefined),
  mockAddUserMessage: vi.fn().mockResolvedValue(undefined),
  mockGetCurrentModel: vi.fn().mockResolvedValue('gpt-5.4@openai-compatible-codex-404115'),
  mockGetAgentId: vi.fn().mockResolvedValue('planner'),
  mockGetWithResolvedTools: vi.fn().mockResolvedValue({
    id: 'planner',
    name: 'Planner',
    modelType: 'main_model',
    systemPrompt: 'test prompt',
    tools: {},
    isDefault: true,
  }),
  mockSetError: vi.fn(),
  mockCreateTask: vi.fn().mockResolvedValue('task-1'),
  mockOnMessageSent: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  dirname: vi.fn().mockResolvedValue('/repo'),
}));

vi.mock('@/hooks/use-execution-state', () => ({
  useExecutionState: vi.fn(() => ({
    isLoading: false,
    serverStatus: '',
    error: undefined,
  })),
}));

vi.mock('@/hooks/use-task', () => ({
  useMessages: vi.fn(() => ({
    messages: [],
    stopStreaming: vi.fn(),
    deleteMessage: vi.fn(),
    deleteMessagesFromIndex: vi.fn(),
    findMessageIndex: vi.fn(() => -1),
  })),
}));

vi.mock('@/hooks/use-tasks', () => ({
  useTasks: vi.fn(() => ({
    currentTaskId: undefined,
    setError: mockSetError,
    createTask: mockCreateTask,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'message-1'),
}));

vi.mock('@/locales', () => ({
  getLocale: vi.fn(() => ({
    Chat: {
      stop: 'Stop',
      placeholder: 'Type a message...',
      planMode: { label: 'Plan Mode' },
      compaction: {
        dialogTitle: 'Compaction',
        compacting: 'Compacting',
        stats: {
          originalMessages: 'Original',
          compactedMessages: 'Compacted',
          reductionPercent: 'Reduction',
          compressionRatio: 'Ratio',
        },
      },
      promptEnhancement: {
        enhancing: 'Enhancing',
        enhanceButton: 'Enhance',
      },
      files: {
        addAttachment: 'Add Attachment',
        uploadImage: 'Upload Image',
        uploadVideo: 'Upload Video',
        uploadFile: 'Upload File',
        dropHere: 'Drop here',
      },
    },
    Settings: { hooks: { blockedPrompt: 'Blocked' } },
    Common: { close: 'Close' },
  })),
}));

vi.mock('@/providers/core/provider-utils', () => ({
  parseModelIdentifier: vi.fn((model: string) => {
    const [modelKey = '', providerId = ''] = model.split('@');
    return { modelKey, providerId };
  }),
}));

vi.mock('@/providers/stores/provider-store', () => ({
  modelService: {
    getCurrentModel: mockGetCurrentModel,
  },
}));

vi.mock('@/services/agents/agent-registry', () => ({
  agentRegistry: {
    getWithResolvedTools: mockGetWithResolvedTools,
  },
}));

vi.mock('@/services/ai/ai-prompt-enhancement-service', () => ({
  aiPromptEnhancementService: { enhancePrompt: vi.fn() },
}));

vi.mock('@/services/commands/command-executor', () => ({
  commandExecutor: {
    parseCommand: vi.fn(() => ({ isValid: false, command: null, rawArgs: '' })),
  },
}));

vi.mock('@/services/commands/command-registry', () => ({
  commandRegistry: { initialize: vi.fn() },
}));

vi.mock('@/services/database-service', () => ({
  databaseService: { deleteMessage: vi.fn() },
}));

vi.mock('@/services/execution-service', () => ({
  executionService: {
    startExecution: mockStartExecution,
    isRunning: vi.fn(() => false),
    stopExecution: vi.fn(),
    getRunningTaskIds: vi.fn(() => []),
  },
}));

vi.mock('@/services/hooks/hook-service', () => ({
  hookService: {
    runUserPromptSubmit: vi.fn().mockResolvedValue({ blocked: false, continue: true }),
    applyHookSummary: vi.fn(),
  },
}));

vi.mock('@/services/message-service', () => ({
  messageService: {
    addUserMessage: mockAddUserMessage,
  },
}));

vi.mock('@/services/prompt/preview', () => ({
  previewSystemPrompt: vi.fn(),
}));

vi.mock('@/services/workspace-root-service', () => ({
  getEffectiveWorkspaceRoot: vi.fn(),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ isAuthenticated: true })),
  },
}));

vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getAgentId: mockGetAgentId,
  },
  useSettingsStore: vi.fn((selector) =>
    selector({
      language: 'en',
    })
  ),
}));

vi.mock('@/stores/task-store', () => ({
  useTaskStore: {
    getState: vi.fn(() => ({
      getTask: vi.fn(() => undefined),
    })),
  },
}));

vi.mock('@/stores/worktree-store', () => ({
  useWorktreeStore: {
    getState: vi.fn(() => ({
      acquireForTask: vi.fn(),
    })),
  },
}));

vi.mock('./ai-elements/task', () => ({
  Task: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TaskContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TaskScrollButton: () => null,
}));

vi.mock('./chat/message-list', () => ({
  MessageList: () => <div data-testid="message-list" />,
}));

vi.mock('./chat/file-changes-summary', () => ({
  FileChangesSummary: () => null,
}));

vi.mock('./talkcody-free-login-dialog', () => ({
  TalkCodyFreeLoginDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="login-dialog">login</div> : null,
}));

vi.mock('./ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('./ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./chat/chat-input', () => ({
  ChatInput: ({
    input,
    onInputChange,
    onSubmit,
  }: {
    input: string;
    onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSubmit: (event: React.FormEvent, attachments?: unknown[]) => Promise<void>;
  }) => (
    <form onSubmit={(event) => void onSubmit(event)}>
      <textarea aria-label="Search" value={input} onChange={onInputChange} />
      <button type="submit">Send</button>
    </form>
  ),
}));

describe('ChatBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentId.mockResolvedValue('planner');
    mockGetCurrentModel.mockResolvedValue('gpt-5.4@openai-compatible-codex-404115');
  });

  it('should send a message without referencing model before initialization', async () => {
    render(<ChatBox onMessageSent={mockOnMessageSent} />);

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith('hello');
      expect(mockGetCurrentModel).toHaveBeenCalled();
      expect(mockAddUserMessage).toHaveBeenCalledWith('task-1', 'hello', {
        attachments: undefined,
        agentId: 'planner',
      });
      expect(mockStartExecution).toHaveBeenCalled();
    });

    expect(mockOnMessageSent).toHaveBeenCalledWith('hello');
    expect(screen.queryByTestId('login-dialog')).not.toBeInTheDocument();
  });
});
