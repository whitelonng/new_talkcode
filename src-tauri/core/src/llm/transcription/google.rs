use crate::llm::auth::api_key_manager::ApiKeyManager;
use crate::llm::transcription::types::{TranscriptionContext, TranscriptionResult};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
}

#[derive(Debug, Clone, Serialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum GeminiPart {
    #[serde(rename = "inline_data")]
    InlineData { inline_data: GeminiInlineData },
    #[serde(rename = "text")]
    Text { text: String },
}

#[derive(Debug, Clone, Serialize)]
struct GeminiInlineData {
    #[serde(rename = "mime_type")]
    mime_type: String,
    data: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(Debug, Clone, Deserialize)]
struct GeminiCandidate {
    content: GeminiCandidateContent,
}

#[derive(Debug, Clone, Deserialize)]
struct GeminiCandidateContent {
    parts: Vec<GeminiResponsePart>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum GeminiResponsePart {
    Text { text: String },
}

pub struct GoogleTranscriptionClient {
    base_url: String,
}

impl GoogleTranscriptionClient {
    pub fn new() -> Self {
        Self {
            base_url: "https://generativelanguage.googleapis.com/v1beta".to_string(),
        }
    }

    #[allow(dead_code)]
    pub fn with_base_url(base_url: String) -> Self {
        Self { base_url }
    }

    pub async fn transcribe(
        &self,
        api_keys: &ApiKeyManager,
        model: &str,
        context: TranscriptionContext,
    ) -> Result<TranscriptionResult, String> {
        // Get API key directly for Google provider
        let api_key = api_keys
            .get_setting(&format!("api_key_{}", "google"))
            .await?
            .unwrap_or_default();

        if api_key.is_empty() {
            return Err("Google API key not configured".to_string());
        }

        // Decode base64 audio
        let audio_bytes = STANDARD
            .decode(context.audio_base64.as_bytes())
            .map_err(|e| format!("Invalid audio base64: {}", e))?;

        // Re-encode to base64 for the API
        let base64_audio = STANDARD.encode(&audio_bytes);

        let request = GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![
                    GeminiPart::InlineData {
                        inline_data: GeminiInlineData {
                            mime_type: context.mime_type,
                            data: base64_audio,
                        },
                    },
                    GeminiPart::Text {
                        text: "Please transcribe this audio accurately. Only return the transcribed text without any additional comments or formatting.".to_string(),
                    },
                ],
            }],
        };

        let url = format!(
            "{}/models/{}:generateContent?key={}",
            self.base_url.trim_end_matches('/'),
            model,
            api_key
        );

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Google Gemini transcription request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!(
                "Google transcription failed ({}): {}",
                status, body
            ));
        }

        let payload = response
            .json::<GeminiResponse>()
            .await
            .map_err(|e| format!("Failed to parse Google response: {}", e))?;

        let text = payload
            .candidates
            .first()
            .and_then(|c| c.content.parts.first())
            .map(|p| match p {
                GeminiResponsePart::Text { text } => text.clone(),
            })
            .unwrap_or_default();

        Ok(TranscriptionResult {
            text,
            language: None,
            duration_in_seconds: None,
        })
    }
}

impl Default for GoogleTranscriptionClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_response() {
        let json = r#"{"candidates":[{"content":{"parts":[{"text":"Hello from Gemini"}]}}]}"#;
        let parsed: GeminiResponse = serde_json::from_str(json).expect("parse response");
        match &parsed.candidates[0].content.parts[0] {
            GeminiResponsePart::Text { text } => assert_eq!(text, "Hello from Gemini"),
        }
    }

    #[test]
    fn serializes_request() {
        let request = GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![
                    GeminiPart::InlineData {
                        inline_data: GeminiInlineData {
                            mime_type: "audio/webm".to_string(),
                            data: "base64data".to_string(),
                        },
                    },
                    GeminiPart::Text {
                        text: "Transcribe this".to_string(),
                    },
                ],
            }],
        };
        let json = serde_json::to_string(&request).expect("serialize request");
        assert!(json.contains("inline_data"));
        assert!(json.contains("audio/webm"));
        assert!(json.contains("Transcribe this"));
    }
}
