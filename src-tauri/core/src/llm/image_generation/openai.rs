use crate::llm::auth::api_key_manager::ApiKeyManager;
use crate::llm::image_generation::types::{GeneratedImage, ImageGenerationRequest};
use crate::llm::providers::provider::BaseProvider;
use crate::llm::types::ProviderConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
struct OpenAiImageRequest {
    model: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    size: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    quality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    n: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAiImageResponse {
    data: Vec<OpenAiImageData>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAiImageData {
    #[serde(rename = "b64_json")]
    b64_json: Option<String>,
    url: Option<String>,
    #[serde(rename = "revised_prompt")]
    revised_prompt: Option<String>,
}

pub struct OpenAiImageClient {
    config: ProviderConfig,
}

impl OpenAiImageClient {
    pub fn new(config: ProviderConfig) -> Self {
        Self { config }
    }

    pub async fn generate(
        &self,
        api_keys: &ApiKeyManager,
        model: &str,
        request: ImageGenerationRequest,
    ) -> Result<Vec<GeneratedImage>, String> {
        let credentials = api_keys.get_credentials(&self.config).await?;
        let api_key = match credentials {
            crate::llm::auth::api_key_manager::ProviderCredentials::Token(token) => token,
            crate::llm::auth::api_key_manager::ProviderCredentials::None => {
                return Err(
                    "API key not configured for OpenAI image generation / OpenAI 图片生成未配置 API 密钥"
                        .to_string(),
                )
            }
        };

        let base = BaseProvider::new(self.config.clone());
        let base_url = base.resolve_base_url_with_fallback(api_keys).await?;
        let url = format!("{}/images/generations", base_url.trim_end_matches('/'));

        let body = OpenAiImageRequest {
            model: model.to_string(),
            prompt: request.prompt,
            size: request.size,
            quality: request.quality,
            n: request.n,
            response_format: request.response_format,
        };

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        headers.insert("Authorization".to_string(), format!("Bearer {}", api_key));
        api_keys
            .maybe_set_openai_account_header(&self.config.id, &mut headers)
            .await?;

        let mut header_map = reqwest::header::HeaderMap::new();
        for (key, value) in headers {
            let header_name = reqwest::header::HeaderName::from_bytes(key.as_bytes())
                .map_err(|e| format!("Invalid header name {}: {}", key, e))?;
            let header_value = reqwest::header::HeaderValue::from_str(&value)
                .map_err(|e| format!("Invalid header value for {}: {}", key, e))?;
            header_map.insert(header_name, header_value);
        }

        let response = client
            .post(&url)
            .headers(header_map)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("OpenAI image request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!(
                "OpenAI image generation failed ({}): {} / OpenAI 图片生成失败",
                status, body
            ));
        }

        let payload = response
            .json::<OpenAiImageResponse>()
            .await
            .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

        let images = payload
            .data
            .into_iter()
            .map(|item| GeneratedImage {
                b64_json: item.b64_json,
                url: item.url,
                mime_type: "image/png".to_string(),
                revised_prompt: item.revised_prompt,
            })
            .collect();

        Ok(images)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_openai_image_response_with_b64() {
        let json = r#"{"data":[{"b64_json":"abc","revised_prompt":"hi"}]}"#;
        let parsed: OpenAiImageResponse = serde_json::from_str(json).expect("parse response");
        assert_eq!(parsed.data.len(), 1);
        assert_eq!(parsed.data[0].b64_json.as_deref(), Some("abc"));
        assert_eq!(parsed.data[0].revised_prompt.as_deref(), Some("hi"));
    }

    #[test]
    fn parses_openai_image_response_with_url() {
        let json = r#"{"data":[{"url":"https://example.com/image.png"}]}"#;
        let parsed: OpenAiImageResponse = serde_json::from_str(json).expect("parse response");
        assert_eq!(parsed.data.len(), 1);
        assert_eq!(
            parsed.data[0].url.as_deref(),
            Some("https://example.com/image.png")
        );
    }
}
