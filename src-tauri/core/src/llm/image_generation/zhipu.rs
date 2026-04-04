use crate::llm::auth::api_key_manager::ApiKeyManager;
use crate::llm::image_generation::types::{GeneratedImage, ImageGenerationRequest};
use crate::llm::providers::provider::BaseProvider;
use crate::llm::types::ProviderConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

/// Request format for Zhipu AI GLM-Image generation
/// Uses OpenAI-compatible format
#[derive(Debug, Clone, Serialize)]
struct ZhipuImageRequest {
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

/// Response format from Zhipu AI image generation API
#[derive(Debug, Clone, Deserialize)]
struct ZhipuImageResponse {
    data: Vec<ZhipuImageData>,
}

#[derive(Debug, Clone, Deserialize)]
struct ZhipuImageData {
    #[serde(rename = "b64_json")]
    b64_json: Option<String>,
    url: Option<String>,
    #[serde(rename = "revised_prompt")]
    revised_prompt: Option<String>,
}

pub struct ZhipuImageClient {
    config: ProviderConfig,
}

impl ZhipuImageClient {
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
                    "API key not configured for Zhipu AI image generation / 智谱 AI 图片生成未配置 API 密钥"
                        .to_string(),
                )
            }
        };

        let base = BaseProvider::new(self.config.clone());
        let base_url = base.resolve_base_url_with_fallback(api_keys).await?;
        let url = format!("{}/images/generations", base_url.trim_end_matches('/'));

        let body = ZhipuImageRequest {
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
            .map_err(|e| format!("Zhipu AI image request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!(
                "Zhipu AI image generation failed ({}): {} / 智谱 AI 图片生成失败",
                status, body
            ));
        }

        let payload = response
            .json::<ZhipuImageResponse>()
            .await
            .map_err(|e| format!("Failed to parse Zhipu AI response: {}", e))?;

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
    fn parses_zhipu_image_response_with_b64() {
        let json = r#"{"data":[{"b64_json":"base64data","revised_prompt":"refined"}]}"#;
        let parsed: ZhipuImageResponse = serde_json::from_str(json).expect("parse response");
        assert_eq!(parsed.data.len(), 1);
        assert_eq!(parsed.data[0].b64_json.as_deref(), Some("base64data"));
        assert_eq!(parsed.data[0].revised_prompt.as_deref(), Some("refined"));
    }

    #[test]
    fn parses_zhipu_image_response_with_url() {
        let json =
            r#"{"data":[{"url":"https://example.com/glm-image.png","revised_prompt":"test"}]}"#;
        let parsed: ZhipuImageResponse = serde_json::from_str(json).expect("parse response");
        assert_eq!(parsed.data.len(), 1);
        assert_eq!(
            parsed.data[0].url.as_deref(),
            Some("https://example.com/glm-image.png")
        );
        assert_eq!(parsed.data[0].revised_prompt.as_deref(), Some("test"));
    }

    #[test]
    fn parses_zhipu_image_response_with_both() {
        let json = r#"{"data":[{"b64_json":"base64","url":"https://example.com/img.png","revised_prompt":"both"}]}"#;
        let parsed: ZhipuImageResponse = serde_json::from_str(json).expect("parse response");
        assert_eq!(parsed.data.len(), 1);
        assert_eq!(parsed.data[0].b64_json.as_deref(), Some("base64"));
        assert_eq!(
            parsed.data[0].url.as_deref(),
            Some("https://example.com/img.png")
        );
    }

    #[test]
    fn zhipu_image_client_constructs() {
        let config = ProviderConfig {
            id: "zhipu".to_string(),
            name: "Zhipu AI".to_string(),
            protocol: crate::llm::types::ProtocolType::OpenAiCompatible,
            base_url: "https://open.bigmodel.cn/api/paas/v4".to_string(),
            api_key_name: "ZHIPU_API_KEY".to_string(),
            supports_oauth: false,
            supports_coding_plan: false,
            supports_international: false,
            coding_plan_base_url: None,
            international_base_url: None,
            headers: None,
            extra_body: None,
            auth_type: crate::llm::types::AuthType::Bearer,
        };
        let _client = ZhipuImageClient::new(config);
    }
}
