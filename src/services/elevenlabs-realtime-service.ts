// Real-time speech-to-text service using Eleven Labs Scribe V2 Realtime API

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { logger } from '@/lib/logger';

type PartialTranscriptCallback = (text: string) => void;
type FinalTranscriptCallback = (text: string) => void;
type ErrorCallback = (error: Error) => void;
type ConnectedCallback = () => void;

interface SessionStartedMessage {
  message_type: 'session_started';
}

interface PartialTranscriptMessage {
  message_type: 'partial_transcript';
  text: string;
}

interface CommittedTranscriptMessage {
  message_type: 'committed_transcript' | 'committed_transcript_with_timestamps';
  text: string;
}

interface ErrorMessage {
  message_type: 'error' | 'auth_error' | 'quota_exceeded' | 'transcriber_error' | 'input_error';
  message?: string;
}

type WebSocketMessage =
  | SessionStartedMessage
  | PartialTranscriptMessage
  | CommittedTranscriptMessage
  | ErrorMessage;

/**
 * Real-time speech-to-text service using Tauri WebSocket
 * Uses native WebSocket to support custom headers (xi-api-key)
 */
export class ElevenLabsRealtimeService {
  private partialCallback?: PartialTranscriptCallback;
  private finalCallback?: FinalTranscriptCallback;
  private errorCallback?: ErrorCallback;
  private connectedCallback?: ConnectedCallback;
  private isConnected = false;
  private unlistenMessage?: UnlistenFn;
  private unlistenClosed?: UnlistenFn;
  private unlistenError?: UnlistenFn;
  private unlistenConnected?: UnlistenFn;

  /**
   * Connect to Eleven Labs real-time transcription service
   *
   * @param apiKey - Eleven Labs API key
   * @param languageCode - Optional language code
   */
  async connect(apiKey: string, languageCode?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          this.disconnect();
          reject(new Error('Connection timeout'));
        }
      }, 10000);

      // Set up event listeners
      Promise.all([
        listen<{ data: string }>('ws-message', (event) => {
          this.handleMessage(event.payload.data);
        }),
        listen('ws-closed', () => {
          logger.info('[ElevenLabs Realtime] WebSocket closed');
          this.isConnected = false;
        }),
        listen<string>('ws-error', (event) => {
          logger.error('[ElevenLabs Realtime] WebSocket error:', event.payload);
          const error = new Error(event.payload);
          this.errorCallback?.(error);
          if (!this.isConnected) {
            clearTimeout(timeout);
            reject(error);
          }
        }),
        listen('ws-connected', () => {
          logger.info('[ElevenLabs Realtime] Connected successfully');
          this.isConnected = true;
          this.connectedCallback?.();
          clearTimeout(timeout);
          resolve();
        }),
      ])
        .then(([unlistenMessage, unlistenClosed, unlistenError, unlistenConnected]) => {
          this.unlistenMessage = unlistenMessage;
          this.unlistenClosed = unlistenClosed;
          this.unlistenError = unlistenError;
          this.unlistenConnected = unlistenConnected;

          // Build WebSocket URL
          const params = new URLSearchParams({
            model_id: 'scribe_v2_realtime',
            audio_format: 'pcm_16000',
          });

          if (languageCode) {
            params.append('language_code', languageCode);
          }

          const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;

          logger.info('[ElevenLabs Realtime] Connecting to WebSocket via Tauri...', {
            hasApiKey: !!apiKey,
          });

          // Connect using Tauri command with API key header
          return invoke<void>('ws_connect', { url, apiKey });
        })
        .catch((error) => {
          clearTimeout(timeout);
          logger.error('[ElevenLabs Realtime] Connection error:', error);
          reject(error);
        });
    });
  }

  /**
   * Stream PCM audio chunk to the server
   */
  streamPCMAudio(pcmInt16Array: Int16Array): void {
    if (!this.isConnected) {
      logger.warn('[ElevenLabs Realtime] Cannot stream audio: not connected');
      return;
    }

    try {
      const base64 = this.int16ToBase64(pcmInt16Array);

      const message = JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: base64,
        commit: false,
        sample_rate: 16000,
      });

      invoke<void>('ws_send', { message }).catch((error) => {
        logger.error('[ElevenLabs Realtime] Error sending audio:', error);
        this.errorCallback?.(error instanceof Error ? error : new Error(String(error)));
      });
    } catch (error) {
      logger.error('[ElevenLabs Realtime] Error streaming audio:', error);
      this.errorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Commit the current audio stream
   */
  commit(): void {
    if (!this.isConnected) {
      logger.warn('[ElevenLabs Realtime] Cannot commit: not connected');
      return;
    }

    logger.info('[ElevenLabs Realtime] Committing audio stream...');

    try {
      // Send end-of-stream signal with correct format
      const message = JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: '',
        commit: true,
        sample_rate: 16000,
      });

      invoke<void>('ws_send', { message }).catch((error) => {
        logger.error('[ElevenLabs Realtime] Error committing:', error);
        this.errorCallback?.(error instanceof Error ? error : new Error(String(error)));
      });
    } catch (error) {
      logger.error('[ElevenLabs Realtime] Error committing:', error);
      this.errorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Disconnect from service
   */
  disconnect(): void {
    logger.info('[ElevenLabs Realtime] Disconnecting...');

    // Unlisten all events
    this.unlistenMessage?.();
    this.unlistenClosed?.();
    this.unlistenError?.();
    this.unlistenConnected?.();

    // Disconnect WebSocket
    invoke<void>('ws_disconnect').catch((error) => {
      logger.error('[ElevenLabs Realtime] Error disconnecting:', error);
    });

    this.isConnected = false;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WebSocketMessage;

      logger.debug('[ElevenLabs Realtime] Received message:', message.message_type);

      switch (message.message_type) {
        case 'session_started':
          logger.info('[ElevenLabs Realtime] Session started');
          break;

        case 'partial_transcript':
          if ('text' in message && message.text) {
            logger.debug('[ElevenLabs Realtime] Partial transcript:', message.text);
            this.partialCallback?.(message.text);
          }
          break;

        case 'committed_transcript':
        case 'committed_transcript_with_timestamps':
          if ('text' in message && message.text) {
            logger.info('[ElevenLabs Realtime] Final transcript:', message.text);
            this.finalCallback?.(message.text);
          }
          break;

        case 'auth_error':
          logger.error('[ElevenLabs Realtime] Authentication error');
          this.errorCallback?.(new Error('Authentication failed. Please check your API key.'));
          this.disconnect();
          break;

        case 'quota_exceeded':
          logger.error('[ElevenLabs Realtime] Quota exceeded');
          this.errorCallback?.(
            new Error('API quota exceeded. Please check your Eleven Labs account.')
          );
          this.disconnect();
          break;

        case 'transcriber_error':
        case 'input_error':
        case 'error':
          logger.error('[ElevenLabs Realtime] Error:', message.message);
          this.errorCallback?.(new Error(message.message || 'Transcription error occurred'));
          break;

        default:
          logger.debug('[ElevenLabs Realtime] Unknown message type:', message);
      }
    } catch (error) {
      logger.error('[ElevenLabs Realtime] Error parsing message:', error);
    }
  }

  /**
   * Register callbacks
   */
  onPartialTranscript(callback: PartialTranscriptCallback): void {
    this.partialCallback = callback;
  }

  onFinalTranscript(callback: FinalTranscriptCallback): void {
    this.finalCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  onConnected(callback: ConnectedCallback): void {
    this.connectedCallback = callback;
  }

  /**
   * Convert Int16Array to Base64
   */
  private int16ToBase64(int16Array: Int16Array): string {
    const bytes = new Uint8Array(int16Array.buffer);
    const chunkSize = 8192;
    const chunks: string[] = [];

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      chunks.push(String.fromCharCode(...chunk));
    }

    return btoa(chunks.join(''));
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
