use serde::{Deserialize, Serialize};

/// Request context for transcription
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionContext {
    #[serde(rename = "audioBase64")]
    pub audio_base64: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub language: Option<String>,
    pub prompt: Option<String>,
    pub temperature: Option<f32>,
    #[serde(rename = "responseFormat")]
    pub response_format: Option<String>,
}

/// Result of transcription
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub language: Option<String>,
    #[serde(rename = "durationInSeconds")]
    pub duration_in_seconds: Option<f32>,
}

/// Supported transcription providers
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TranscriptionProvider {
    OpenRouter,
    OpenAI,
    Google,
    Groq,
}

impl TranscriptionProvider {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "openrouter" => Some(Self::OpenRouter),
            "openai" => Some(Self::OpenAI),
            "google" => Some(Self::Google),
            "groq" => Some(Self::Groq),
            _ => None,
        }
    }

    pub fn as_id(&self) -> &'static str {
        match self {
            Self::OpenRouter => "openrouter",
            Self::OpenAI => "openai",
            Self::Google => "google",
            Self::Groq => "groq",
        }
    }
}

/// Error types for transcription
#[derive(Debug, Clone)]
pub enum TranscriptionError {
    NoModelConfigured,
    NoAvailableProvider,
    ProviderNotSupported(String),
    ApiKeyNotConfigured(String),
    RequestFailed(String),
    ParseError(String),
    EmptyResult,
}

impl std::fmt::Display for TranscriptionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoModelConfigured => {
                write!(f, "No transcription model configured. Please select a transcription model in settings.")
            }
            Self::NoAvailableProvider => {
                write!(f, "No available provider for transcription. Please configure API keys in settings.")
            }
            Self::ProviderNotSupported(provider) => {
                write!(f, "Transcription not supported for provider: {}", provider)
            }
            Self::ApiKeyNotConfigured(provider) => {
                write!(f, "{} API key not configured", provider)
            }
            Self::RequestFailed(msg) => write!(f, "Transcription failed: {}", msg),
            Self::ParseError(msg) => write!(f, "Failed to parse response: {}", msg),
            Self::EmptyResult => write!(f, "Transcription returned empty text"),
        }
    }
}

impl std::error::Error for TranscriptionError {}

impl From<TranscriptionError> for String {
    fn from(err: TranscriptionError) -> Self {
        err.to_string()
    }
}
