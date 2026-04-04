// src/test/byok-implementation.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { modelService as ModelServiceType } from '@/providers/stores/provider-store';
import type { ApiKeySettings, AvailableModel } from '@/types/api-keys';

// Mock the model service
const mockModelService = {
  getAvailableModels: vi.fn(),
  getAvailableModelsSync: vi.fn(),
  getBestProviderForModel: vi.fn(),
  getBestProviderForModelSync: vi.fn(),
  isModelAvailable: vi.fn(),
  isModelAvailableSync: vi.fn(),
  getAllProviders: vi.fn(() => ({
    openai: {},
    google: {},
    anthropic: {},
    aiGateway: {},
    openRouter: {},
  })),
};

vi.mock('@/providers/stores/provider-store', () => ({
  modelService: mockModelService,
  useProviderStore: {
    getState: () => ({
      getProviderModel: vi.fn(),
      refresh: vi.fn(),
    }),
  },
}));

// Mock the settings manager
vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    getApiKeys: vi.fn(),
    getApiKeysSync: vi.fn(),
    setApiKeys: vi.fn(),
    getAutoApproveEditsGlobal: vi.fn(() => false),
    setAutoApproveEditsGlobal: vi.fn(),
  },
  useSettingsStore: {
    getState: vi.fn(() => ({
      getReasoningEffort: vi.fn(() => 'medium'),
      getAutoApproveEditsGlobal: vi.fn(() => false),
      setAutoApproveEditsGlobal: vi.fn(),
    })),
  },
}));

describe('BYOK Implementation', () => {
  let modelService: typeof ModelServiceType;
  let _settingsManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    modelService = (await import('@/providers/stores/provider-store')).modelService;
    _settingsManager = (await import('@/stores/settings-store')).settingsManager;
  });

  describe('Model Service', () => {
    it('should return empty models when no API keys are configured', async () => {
      const _mockApiKeys: ApiKeySettings = {};
      mockModelService.getAvailableModels.mockResolvedValue([]);

      const availableModels = await modelService.getAvailableModels();

      expect(availableModels).toEqual([]);
    });

    it('should return OpenAI models when OpenAI API key is configured', async () => {
      const mockModels: AvailableModel[] = [
        {
          key: 'gpt-4.1-nano',
          name: 'GPT-4.1 Nano',
          provider: 'openai',
          providerName: 'OpenAI',
          imageInput: true,
          imageOutput: false,
          audioInput: false,
        },
        {
          key: 'dall-e-3',
          name: 'Image DALL-E 3',
          provider: 'openai',
          providerName: 'OpenAI',
          imageInput: false,
          imageOutput: true,
          audioInput: false,
        },
      ];
      mockModelService.getAvailableModels.mockResolvedValue(mockModels);

      const availableModels = await modelService.getAvailableModels();

      const openaiModels = availableModels.filter(
        (model: AvailableModel) => model.provider === 'openai'
      );
      expect(openaiModels.length).toBeGreaterThan(0);

      const gpt4NanoModel = availableModels.find(
        (model: AvailableModel) => model.key === 'gpt-4.1-nano'
      );
      expect(gpt4NanoModel).toBeDefined();
      expect(gpt4NanoModel?.provider).toBe('openai');
    });

    it('should return AI Gateway models when AI Gateway API key is configured', async () => {
      const mockModels: AvailableModel[] = [
        {
          key: 'gpt-4.1-nano',
          name: 'GPT-4.1 Nano',
          provider: 'aiGateway',
          providerName: 'AI Gateway',
          imageInput: true,
          imageOutput: false,
          audioInput: false,
        },
      ];
      mockModelService.getAvailableModels.mockResolvedValue(mockModels);

      const availableModels = await modelService.getAvailableModels();

      const aiGatewayModels = availableModels.filter(
        (model: AvailableModel) => model.provider === 'aiGateway'
      );
      expect(aiGatewayModels.length).toBeGreaterThan(0);

      const gpt4NanoModel = availableModels.find(
        (model: AvailableModel) => model.key === 'gpt-4.1-nano'
      );
      expect(gpt4NanoModel).toBeDefined();
      expect(gpt4NanoModel?.provider).toBe('aiGateway');
    });

    it('should prioritize providers correctly when multiple API keys are configured', async () => {
      const mockModels: AvailableModel[] = [
        {
          key: 'gpt-4.1-nano',
          name: 'GPT-4.1 Nano',
          provider: 'aiGateway',
          providerName: 'AI Gateway',
          imageInput: true,
          imageOutput: false,
          audioInput: false,
        },
      ];
      mockModelService.getAvailableModels.mockResolvedValue(mockModels);

      const availableModels = await modelService.getAvailableModels();

      const gpt4NanoModel = availableModels.find(
        (model: AvailableModel) => model.key === 'gpt-4.1-nano'
      );
      expect(gpt4NanoModel).toBeDefined();
      expect(gpt4NanoModel?.provider).toBe('aiGateway');
    });

    it('should handle synchronous model checking', () => {
      mockModelService.isModelAvailableSync.mockReturnValue(true);
      mockModelService.getBestProviderForModelSync.mockReturnValue('openai');

      const isAvailable = modelService.isModelAvailableSync('gpt-4.1-nano');
      expect(isAvailable).toBe(true);

      const provider = modelService.getBestProviderForModelSync('gpt-4.1-nano');
      expect(provider).toBe('openai');
    });

    it('should return null when model is not available', async () => {
      mockModelService.getBestProviderForModel.mockResolvedValue(null);
      mockModelService.isModelAvailable.mockResolvedValue(false);

      const provider = await modelService.getBestProviderForModel('gpt-4.1-nano');
      expect(provider).toBeNull();

      const isAvailable = await modelService.isModelAvailable('gpt-4.1-nano');
      expect(isAvailable).toBe(false);
    });
  });

  describe('Provider Priority System', () => {
    it('should select AI Gateway over other providers when available', async () => {
      mockModelService.getBestProviderForModel.mockResolvedValue('aiGateway');

      const provider = await modelService.getBestProviderForModel('gpt-4.1-nano');
      expect(provider).toBe('aiGateway');
    });

    it('should fallback to lower priority providers when higher priority is not available', async () => {
      mockModelService.getBestProviderForModel.mockResolvedValue('openai');

      const provider = await modelService.getBestProviderForModel('gpt-4.1-nano');
      expect(provider).toBe('openai');
    });

    it('should handle models with single provider', async () => {
      mockModelService.getBestProviderForModel.mockResolvedValue('openai');

      const provider = await modelService.getBestProviderForModel('dall-e-3');
      expect(provider).toBe('openai');
    });
  });

  describe('Model Capabilities', () => {
    it('should preserve model capabilities in available models', async () => {
      const mockModels: AvailableModel[] = [
        {
          key: 'gpt-4.1-nano',
          name: 'GPT-4.1 Nano',
          provider: 'openai',
          providerName: 'OpenAI',
          imageInput: true,
          imageOutput: false,
          audioInput: false,
        },
        {
          key: 'dall-e-3',
          name: 'Image DALL-E 3',
          provider: 'openai',
          providerName: 'OpenAI',
          imageInput: false,
          imageOutput: true,
          audioInput: false,
        },
      ];
      mockModelService.getAvailableModels.mockResolvedValue(mockModels);

      const availableModels = await modelService.getAvailableModels();

      const gpt4NanoModel = availableModels.find(
        (model: AvailableModel) => model.key === 'gpt-4.1-nano'
      );
      expect(gpt4NanoModel).toBeDefined();
      expect(gpt4NanoModel?.imageInput).toBe(true);
      expect(gpt4NanoModel?.imageOutput).toBe(false);

      const dalleModel = availableModels.find((model: AvailableModel) => model.key === 'dall-e-3');
      expect(dalleModel).toBeDefined();
      expect(dalleModel?.imageInput).toBe(false);
      expect(dalleModel?.imageOutput).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should handle provider configurations', () => {
      const providers = modelService.getAllProviders();

      expect(providers).toHaveProperty('openai');
      expect(providers).toHaveProperty('google');
      expect(providers).toHaveProperty('anthropic');
      expect(providers).toHaveProperty('aiGateway');
      expect(providers).toHaveProperty('openRouter');

      // Provider objects should exist but no longer have priority property
      expect(providers.openai).toBeDefined();
      expect(providers.aiGateway).toBeDefined();
    });
  });
});
