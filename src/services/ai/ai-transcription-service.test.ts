import { describe, expect, it, vi } from 'vitest';
import { aiTranscriptionService } from '@/services/ai/ai-transcription-service';

vi.mock('@/stores/settings-store', () => ({
  settingsManager: {
    get: vi.fn(),
    getApiKeys: vi.fn(),
    getProviderBaseUrl: vi.fn(),
  },
}));

vi.mock('@/providers/config/model-config', () => ({
  getProvidersForModel: vi.fn(),
  MODEL_CONFIGS: {
    'whisper-large-v3-turbo': {
      providerMappings: {},
    },
  },
}));

vi.mock('@/services/llm/llm-client', () => ({
  llmClient: {
    transcribeAudio: vi.fn(),
  },
}));

describe('AITranscriptionService - Groq', () => {
  it('uses Rust Groq transcription path', async () => {
    const { settingsManager } = await import('@/stores/settings-store');
    const { getProvidersForModel } = await import('@/providers/config/model-config');
    const { llmClient } = await import('@/services/llm/llm-client');

    vi.mocked(settingsManager.get).mockResolvedValue('whisper-large-v3-turbo@groq');
    vi.mocked(settingsManager.getApiKeys).mockResolvedValue({ groq: 'test-key' });
    vi.mocked(getProvidersForModel).mockReturnValue([
      {
        id: 'groq',
        name: 'Groq',
      },
    ]);
    vi.mocked(llmClient.transcribeAudio).mockResolvedValue({
      text: 'Hello world',
      language: 'en',
      duration: 1.2,
    });

    const audioBuffer = new Uint8Array([1, 2, 3]).buffer;
    const audioBlob = {
      type: 'audio/webm',
      size: audioBuffer.byteLength,
      arrayBuffer: async () => audioBuffer,
    } as Blob;
    const result = await aiTranscriptionService.transcribe({ audioBlob });

    expect(llmClient.transcribeAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'whisper-large-v3-turbo@groq',
        mimeType: 'audio/webm',
        responseFormat: 'verbose_json',
      })
    );
    expect(result).toEqual({
      text: 'Hello world',
      language: 'en',
      durationInSeconds: 1.2,
    });
  });
});
