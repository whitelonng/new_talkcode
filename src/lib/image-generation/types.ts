/**
 * Image Generation Types
 */

export interface ImageGenerationOptions {
  /** Image generation prompt */
  prompt: string;
  /** Image size (e.g., "1024x1024", "1024x1536", "1536x1024") */
  size?: string;
  /** Image quality ("standard", "high", "hd") */
  quality?: string;
  /** Number of images to generate (default: 1) */
  n?: number;
  /** Force specific provider ("openai", "google", "aiGateway") */
  provider?: string;
}

export interface GeneratedImage {
  /** Base64 encoded image data or URL */
  url: string;
  /** Image format (e.g., "png", "jpeg") */
  format?: string;
  /** Revised prompt if any modifications were made */
  revisedPrompt?: string;
}

export interface ImageGenerationResult {
  /** Provider used for generation */
  provider: string;
  /** Generated images */
  images: GeneratedImage[];
  /** Request ID for tracking */
  requestId?: string;
  /** Error message if generation failed */
  error?: string;
}

/** Provider configuration for image generation */
export interface ImageProviderConfig {
  id: string;
  name: string;
  /** API key name in settings */
  apiKeyName: string;
  /** Default model for this provider */
  defaultModel: string;
  /** Supported sizes */
  supportedSizes: string[];
  /** Whether provider is available */
  isAvailable: (apiKeys: Record<string, string>) => boolean;
}
