// Service for generating Eleven Labs single-use tokens for real-time transcription

import { logger } from '@/lib/logger';
import { simpleFetch } from '@/lib/tauri-fetch';

interface TokenResponse {
  token: string;
}

interface TokenError {
  detail: {
    status: string;
    message: string;
  };
}

/**
 * Generate a single-use token for Eleven Labs real-time speech-to-text
 * Token is valid for 15 minutes
 *
 * @param apiKey - Eleven Labs API key
 * @returns Single-use token string
 * @throws Error if token generation fails
 */
export async function generateElevenLabsToken(apiKey: string): Promise<string> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Eleven Labs API key is required');
  }

  try {
    logger.info('[ElevenLabs Token] Generating single-use token...');

    const response = await simpleFetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Content-Length': '0',
        },
        body: '',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Token generation failed with status ${response.status}`;

      try {
        const errorData = JSON.parse(errorText) as TokenError;
        if (errorData.detail?.message) {
          errorMessage = errorData.detail.message;
        }
      } catch {
        // If error parsing fails, use default message
      }

      logger.error('[ElevenLabs Token] Generation failed:', errorMessage);

      if (response.status === 401) {
        throw new Error('Invalid Eleven Labs API key');
      }
      if (response.status === 429) {
        throw new Error('Eleven Labs API quota exceeded');
      }

      throw new Error(errorMessage);
    }

    const data = (await response.json()) as TokenResponse;

    if (!data.token) {
      throw new Error('Token not found in response');
    }

    logger.info('[ElevenLabs Token] Token generated successfully');
    return data.token;
  } catch (error) {
    if (error instanceof Error) {
      logger.error('[ElevenLabs Token] Error:', error.message);
      throw error;
    }

    logger.error('[ElevenLabs Token] Unknown error:', error);
    throw new Error('Failed to generate Eleven Labs token');
  }
}
