use crate::llm::auth::api_key_manager::ApiKeyManager;
use crate::llm::providers::provider::BaseProvider;
use crate::llm::types::ProviderConfig;
use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroqTranscriptionRequest {
    pub model: String,
    pub audio_base64: String,
    pub mime_type: String,
    pub language: Option<String>,
    pub prompt: Option<String>,
    pub temperature: Option<f32>,
    pub response_format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroqTranscriptionResponse {
    pub text: String,
    pub language: Option<String>,
    pub duration: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GroqVerboseResponse {
    text: String,
    language: Option<String>,
    duration: Option<f32>,
}

pub struct GroqTranscriptionClient {
    config: ProviderConfig,
}

impl GroqTranscriptionClient {
    pub fn new(config: ProviderConfig) -> Self {
        Self { config }
    }

    pub async fn transcribe(
        &self,
        api_keys: &ApiKeyManager,
        request: GroqTranscriptionRequest,
    ) -> Result<GroqTranscriptionResponse, String> {
        let credentials = api_keys.get_credentials(&self.config).await?;
        let api_key = match credentials {
            crate::llm::auth::api_key_manager::ProviderCredentials::Token(token) => token,
            crate::llm::auth::api_key_manager::ProviderCredentials::None => {
                return Err("Groq API key not configured".to_string());
            }
        };

        let base = BaseProvider::new(self.config.clone());
        let base_url = base.resolve_base_url_with_fallback(api_keys).await?;
        let url = format!("{}/audio/transcriptions", base_url.trim_end_matches('/'));

        let audio_bytes = STANDARD
            .decode(request.audio_base64.as_bytes())
            .map_err(|e| format!("Invalid audio base64: {}", e))?;

        // Extract the base MIME type (remove parameters like codecs=opus)
        let base_mime_type = request
            .mime_type
            .split(';')
            .next()
            .unwrap_or(&request.mime_type)
            .trim();

        // Map MIME type to file extension for Groq's supported formats
        let file_extension = match base_mime_type {
            "audio/webm" => "webm",
            "audio/flac" => "flac",
            "audio/mp3" | "audio/mpeg" => "mp3",
            "audio/mp4" | "audio/m4a" => "m4a",
            "audio/ogg" => "ogg",
            "audio/opus" => "opus",
            "audio/wav" | "audio/wave" => "wav",
            _ => "webm", // Default to webm as it's commonly used
        };

        let file_name = format!("audio.{}", file_extension);

        let file_part = Part::bytes(audio_bytes)
            .file_name(file_name)
            .mime_str(base_mime_type)
            .map_err(|e| format!("Invalid mime type: {}", e))?;

        let mut form = Form::new()
            .part("file", file_part)
            .text("model", request.model.clone());

        if let Some(language) = request.language.as_ref() {
            if !language.trim().is_empty() {
                form = form.text("language", language.clone());
            }
        }

        if let Some(prompt) = request.prompt.as_ref() {
            if !prompt.trim().is_empty() {
                form = form.text("prompt", prompt.clone());
            }
        }

        if let Some(temperature) = request.temperature {
            form = form.text("temperature", temperature.to_string());
        }

        let response_format = request
            .response_format
            .clone()
            .unwrap_or_else(|| "verbose_json".to_string());
        form = form.text("response_format", response_format);

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let response = client
            .post(&url)
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("Groq transcription request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Groq transcription failed ({}): {}", status, body));
        }

        let payload = response
            .json::<GroqVerboseResponse>()
            .await
            .map_err(|e| format!("Failed to parse Groq response: {}", e))?;

        Ok(GroqTranscriptionResponse {
            text: payload.text,
            language: payload.language,
            duration: payload.duration,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_verbose_response() {
        let json = r#"{"text":"hello","language":"en","duration":1.5}"#;
        let parsed: GroqVerboseResponse = serde_json::from_str(json).expect("parse response");
        assert_eq!(parsed.text, "hello");
        assert_eq!(parsed.language.as_deref(), Some("en"));
        assert_eq!(parsed.duration, Some(1.5));
    }
}
