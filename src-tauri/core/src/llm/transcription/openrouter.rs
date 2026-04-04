use crate::llm::auth::api_key_manager::ApiKeyManager;
use crate::llm::providers::provider::BaseProvider;
use crate::llm::transcription::types::{TranscriptionContext, TranscriptionResult};
use crate::llm::types::ProviderConfig;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
struct OpenRouterMessage {
    role: String,
    content: Vec<OpenRouterContent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
enum OpenRouterContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "input_audio")]
    InputAudio { input_audio: InputAudioData },
}

#[derive(Debug, Clone, Serialize)]
struct InputAudioData {
    data: String,
    format: String,
}

#[derive(Debug, Clone, Serialize)]
struct OpenRouterRequest {
    model: String,
    messages: Vec<OpenRouterMessage>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenRouterResponse {
    choices: Vec<OpenRouterChoice>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenRouterChoice {
    message: OpenRouterMessageResponse,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenRouterMessageResponse {
    content: String,
}

pub struct OpenRouterTranscriptionClient {
    config: ProviderConfig,
}

impl OpenRouterTranscriptionClient {
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
            _ => return Err("OpenRouter API key not configured".to_string()),
        };

        let base = BaseProvider::new(self.config.clone());
        let base_url = base.resolve_base_url_with_fallback(api_keys).await?;
        let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

        // Decode base64 audio
        let audio_bytes = STANDARD
            .decode(context.audio_base64.as_bytes())
            .map_err(|e| format!("Invalid audio base64: {}", e))?;

        // Re-encode to base64 for the API
        let base64_audio = STANDARD.encode(&audio_bytes);

        // Determine audio format from MIME type
        let format = Self::detect_audio_format(&context.mime_type);

        let request = OpenRouterRequest {
            model: model.to_string(),
            messages: vec![OpenRouterMessage {
                role: "user".to_string(),
                content: vec![
                    OpenRouterContent::Text {
                        text: "Please transcribe the following audio accurately. Only return the transcribed text without any additional comments or formatting.".to_string(),
                    },
                    OpenRouterContent::InputAudio {
                        input_audio: InputAudioData {
                            data: base64_audio,
                            format,
                        },
                    },
                ],
            }],
        };

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let response = client
            .post(&url)
            .bearer_auth(api_key)
            .header("HTTP-Referer", "https://talkcody.com")
            .header("X-Title", "TalkCody")
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("OpenRouter transcription request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!(
                "OpenRouter transcription failed ({}): {}",
                status, body
            ));
        }

        let payload = response
            .json::<OpenRouterResponse>()
            .await
            .map_err(|e| format!("Failed to parse OpenRouter response: {}", e))?;

        let text = payload
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        Ok(TranscriptionResult {
            text,
            language: None,
            duration_in_seconds: None,
        })
    }

    fn detect_audio_format(mime_type: &str) -> String {
        if mime_type.contains("wav") {
            "wav"
        } else if mime_type.contains("mp3") || mime_type.contains("mpeg") {
            "mp3"
        } else if mime_type.contains("webm") {
            "webm"
        } else if mime_type.contains("ogg") {
            "ogg"
        } else if mime_type.contains("m4a") {
            "m4a"
        } else if mime_type.contains("mp4") {
            "mp4"
        } else {
            "wav"
        }
        .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_wav_format() {
        assert_eq!(
            OpenRouterTranscriptionClient::detect_audio_format("audio/wav"),
            "wav"
        );
        assert_eq!(
            OpenRouterTranscriptionClient::detect_audio_format("audio/x-wav"),
            "wav"
        );
    }

    #[test]
    fn detects_mp3_format() {
        assert_eq!(
            OpenRouterTranscriptionClient::detect_audio_format("audio/mp3"),
            "mp3"
        );
        assert_eq!(
            OpenRouterTranscriptionClient::detect_audio_format("audio/mpeg"),
            "mp3"
        );
    }

    #[test]
    fn detects_webm_format() {
        assert_eq!(
            OpenRouterTranscriptionClient::detect_audio_format("audio/webm"),
            "webm"
        );
    }

    #[test]
    fn defaults_to_wav_for_unknown() {
        assert_eq!(
            OpenRouterTranscriptionClient::detect_audio_format("audio/unknown"),
            "wav"
        );
    }

    #[test]
    fn parses_response() {
        let json = r#"{"choices":[{"message":{"content":"Hello world"}}]}"#;
        let parsed: OpenRouterResponse = serde_json::from_str(json).expect("parse response");
        assert_eq!(parsed.choices[0].message.content, "Hello world");
    }
}
