use crate::llm::auth::api_key_manager::ApiKeyManager;
use crate::llm::providers::provider::BaseProvider;
use crate::llm::transcription::types::{TranscriptionContext, TranscriptionResult};
use crate::llm::types::ProviderConfig;
use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIWhisperResponse {
    text: String,
    language: Option<String>,
    duration: Option<f32>,
}

pub struct OpenAITranscriptionClient {
    config: ProviderConfig,
}

impl OpenAITranscriptionClient {
    pub fn new(config: ProviderConfig) -> Self {
        Self { config }
    }

    pub async fn transcribe(
        &self,
        api_keys: &ApiKeyManager,
        model: &str,
        context: TranscriptionContext,
    ) -> Result<TranscriptionResult, String> {
        let credentials = api_keys.get_credentials(&self.config).await?;
        let api_key = match credentials {
            crate::llm::auth::api_key_manager::ProviderCredentials::Token(token) => token,
            _ => return Err("OpenAI API key not configured".to_string()),
        };

        let base = BaseProvider::new(self.config.clone());
        let base_url = base.resolve_base_url_with_fallback(api_keys).await?;
        let url = format!("{}/audio/transcriptions", base_url.trim_end_matches('/'));

        // Decode base64 audio
        let audio_bytes = STANDARD
            .decode(context.audio_base64.as_bytes())
            .map_err(|e| format!("Invalid audio base64: {}", e))?;

        // Determine file extension from MIME type
        let file_ext = Self::detect_file_extension(&context.mime_type);
        let file_name = format!("recording.{}", file_ext);

        let file_part = Part::bytes(audio_bytes)
            .file_name(file_name)
            .mime_str(&context.mime_type)
            .map_err(|e| format!("Invalid mime type: {}", e))?;

        let mut form = Form::new()
            .part("file", file_part)
            .text("model", model.to_string())
            .text("response_format", "verbose_json");

        // Add optional parameters
        if let Some(language) = context.language.as_ref() {
            if !language.trim().is_empty() {
                form = form.text("language", language.clone());
            }
        }

        if let Some(prompt) = context.prompt.as_ref() {
            if !prompt.trim().is_empty() {
                form = form.text("prompt", prompt.clone());
            }
        }

        if let Some(temperature) = context.temperature {
            form = form.text("temperature", temperature.to_string());
        }

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let response = client
            .post(&url)
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("OpenAI transcription request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!(
                "OpenAI transcription failed ({}): {}",
                status, body
            ));
        }

        let payload = response
            .json::<OpenAIWhisperResponse>()
            .await
            .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

        Ok(TranscriptionResult {
            text: payload.text,
            language: payload.language,
            duration_in_seconds: payload.duration,
        })
    }

    fn detect_file_extension(mime_type: &str) -> &'static str {
        if mime_type.contains("wav") {
            "wav"
        } else if mime_type.contains("mp3") || mime_type.contains("mpeg") {
            "mp3"
        } else if mime_type.contains("webm") {
            "webm"
        } else if mime_type.contains("ogg") || mime_type.contains("oga") {
            "ogg"
        } else if mime_type.contains("m4a") || mime_type.contains("mp4") {
            "m4a"
        } else if mime_type.contains("flac") {
            "flac"
        } else if mime_type.contains("mpga") {
            "mp3"
        } else {
            "webm"
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_wav_extension() {
        assert_eq!(
            OpenAITranscriptionClient::detect_file_extension("audio/wav"),
            "wav"
        );
        assert_eq!(
            OpenAITranscriptionClient::detect_file_extension("audio/x-wav"),
            "wav"
        );
    }

    #[test]
    fn detects_mp3_extension() {
        assert_eq!(
            OpenAITranscriptionClient::detect_file_extension("audio/mp3"),
            "mp3"
        );
        assert_eq!(
            OpenAITranscriptionClient::detect_file_extension("audio/mpeg"),
            "mp3"
        );
        assert_eq!(
            OpenAITranscriptionClient::detect_file_extension("audio/mpga"),
            "mp3"
        );
    }

    #[test]
    fn detects_webm_extension() {
        assert_eq!(
            OpenAITranscriptionClient::detect_file_extension("audio/webm"),
            "webm"
        );
    }

    #[test]
    fn defaults_to_webm_for_unknown() {
        assert_eq!(
            OpenAITranscriptionClient::detect_file_extension("audio/unknown"),
            "webm"
        );
    }

    #[test]
    fn parses_verbose_response() {
        let json = r#"{"text":"hello world","language":"en","duration":1.5}"#;
        let parsed: OpenAIWhisperResponse = serde_json::from_str(json).expect("parse response");
        assert_eq!(parsed.text, "hello world");
        assert_eq!(parsed.language.as_deref(), Some("en"));
        assert_eq!(parsed.duration, Some(1.5));
    }

    #[test]
    fn parses_response_without_optional_fields() {
        let json = r#"{"text":"hello"}"#;
        let parsed: OpenAIWhisperResponse = serde_json::from_str(json).expect("parse response");
        assert_eq!(parsed.text, "hello");
        assert_eq!(parsed.language, None);
        assert_eq!(parsed.duration, None);
    }
}
