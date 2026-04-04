import { logger } from '@/lib/logger';
import { llmClient } from '@/services/llm/llm-client';
import { settingsManager } from '@/stores/settings-store';
import { MODEL_TYPE_SETTINGS_KEYS, ModelType } from '@/types/model-types';

export interface TranscriptionContext {
  audioBlob: Blob;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  durationInSeconds?: number;
}

/**
 * NOTE: This service is now a thin wrapper around the Rust backend transcription service.
 * All provider-specific logic (OpenRouter, OpenAI, Google, Groq) has been moved to
 * src-tauri/src/llm/transcription/ in Rust.
 *
 * The Rust implementation provides:
 * - Unified transcription service at llm/transcription/service.rs
 * - Provider-specific clients in llm/transcription/{openrouter,openai,google,groq}.rs
 * - Tauri command exposed via llm/commands.rs as llm_transcribe_audio
 */
class AITranscriptionService {
  async transcribe(context: TranscriptionContext): Promise<TranscriptionResult | null> {
    try {
      logger.info('Starting audio transcription', {
        audioBlobSize: context.audioBlob.size,
        audioBlobType: context.audioBlob.type,
      });

      const startTime = performance.now();

      // Get transcription model from settings
      const settingsKey = MODEL_TYPE_SETTINGS_KEYS[ModelType.TRANSCRIPTION];
      const modelIdentifier = await settingsManager.get(settingsKey);

      if (!modelIdentifier) {
        throw new Error(
          'No transcription model configured. Please select a transcription model in settings.'
        );
      }

      logger.info('Using transcription model:', modelIdentifier);

      // Convert audio blob to base64
      const arrayBuffer = await context.audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Call Rust backend transcription service
      const response = await llmClient.transcribeAudio({
        model: modelIdentifier,
        audioBase64: base64Audio,
        mimeType: context.audioBlob.type || 'audio/webm',
        responseFormat: 'verbose_json',
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      logger.info('Transcription completed', {
        totalTime: `${totalTime.toFixed(2)}ms`,
        textLength: response.text?.length || 0,
        language: response.language,
        duration: response.duration,
      });

      if (!response.text || response.text.trim().length === 0) {
        logger.warn('Transcription returned empty text');
        return null;
      }

      return {
        text: response.text.trim(),
        language: response.language ?? undefined,
        durationInSeconds: response.duration ?? undefined,
      };
    } catch (error) {
      logger.error('Transcription error:', error);

      // Provide more helpful error messages
      if (error instanceof Error) {
        if (
          error.message.includes('No transcription model configured') ||
          error.message.includes('No available provider') ||
          error.message.includes('Transcription not supported')
        ) {
          throw error; // Pass through our custom error messages
        }

        // Detect OpenAI OAuth permission issues
        if (
          error.message.includes('401') &&
          (error.message.includes('insufficient permissions') ||
            error.message.includes('Missing scopes') ||
            error.message.includes('model.request'))
        ) {
          throw new Error(
            `OpenAI OAuth (ChatGPT Plus/Pro) doesn't include API access for transcription. ` +
              `To use voice input, you need an OpenAI API key with billing enabled. ` +
              `Get one at https://platform.openai.com/api-keys`
          );
        }

        throw new Error(`Transcription failed: ${error.message}`);
      }

      throw new Error('Transcription failed: Unknown error occurred');
    }
  }
}

export const aiTranscriptionService = new AITranscriptionService();
