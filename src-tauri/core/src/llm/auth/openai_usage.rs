use crate::llm::auth::api_key_manager::ApiKeyManager;
use crate::llm::auth::api_key_manager::LlmState;
use crate::llm::auth::oauth::refresh_openai_oauth_tokens;
use serde_json::Value;
use std::time::Duration;
use tauri::State;

const OPENAI_USAGE_DEFAULT_URL: &str = "https://chatgpt.com/backend-api/wham/usage";
const OPENAI_OAUTH_MISSING_MESSAGE: &str =
    "OpenAI OAuth not connected. Please connect your OpenAI account in settings.";
const OPENAI_OAUTH_EXPIRED_MESSAGE: &str =
    "OpenAI OAuth session expired. Please reconnect your OpenAI account in settings.";

struct UsageResponse {
    status: reqwest::StatusCode,
    text: String,
}

async fn fetch_usage_with_token(
    client: &reqwest::Client,
    api_keys: &ApiKeyManager,
    token: &str,
) -> Result<UsageResponse, String> {
    let mut headers = std::collections::HashMap::new();
    headers.insert("Accept".to_string(), "application/json".to_string());
    headers.insert("Authorization".to_string(), format!("Bearer {}", token));
    headers.insert("originator".to_string(), "codex_cli_rs".to_string());

    api_keys
        .maybe_set_openai_account_header("openai", &mut headers)
        .await?;

    let mut request = client.get(OPENAI_USAGE_DEFAULT_URL);
    for (key, value) in headers {
        request = request.header(&key, value);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("OpenAI usage request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .unwrap_or_else(|_| "Unknown error".to_string());

    Ok(UsageResponse { status, text })
}

fn is_auth_error(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN
}

async fn load_refresh_token(api_keys: &ApiKeyManager) -> Result<Option<String>, String> {
    let refresh_token = api_keys
        .get_setting("openai_oauth_refresh_token")
        .await?
        .unwrap_or_default();
    Ok((!refresh_token.trim().is_empty()).then_some(refresh_token))
}

async fn refresh_access_token(
    api_keys: &ApiKeyManager,
    refresh_token: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let refreshed = refresh_openai_oauth_tokens(&client, refresh_token, api_keys).await?;
    Ok(refreshed.access_token)
}

pub async fn fetch_openai_oauth_usage(api_keys: &ApiKeyManager) -> Result<Value, String> {
    let token = api_keys
        .get_setting("openai_oauth_access_token")
        .await?
        .unwrap_or_default();
    let refresh_token = load_refresh_token(api_keys).await?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    if token.trim().is_empty() {
        let Some(refresh_token) = refresh_token else {
            return Err(OPENAI_OAUTH_MISSING_MESSAGE.to_string());
        };
        let refreshed_token = refresh_access_token(api_keys, &refresh_token).await?;
        let response = fetch_usage_with_token(&client, api_keys, &refreshed_token).await?;
        let updated_refresh_token = load_refresh_token(api_keys).await?;
        return handle_usage_response(
            response,
            api_keys,
            &client,
            updated_refresh_token.as_deref(),
        )
        .await;
    }

    let response = fetch_usage_with_token(&client, api_keys, &token).await?;
    handle_usage_response(response, api_keys, &client, refresh_token.as_deref()).await
}

async fn handle_usage_response(
    response: UsageResponse,
    api_keys: &ApiKeyManager,
    client: &reqwest::Client,
    refresh_token: Option<&str>,
) -> Result<Value, String> {
    if response.status.is_success() {
        return serde_json::from_str(&response.text)
            .map_err(|e| format!("Failed to parse OpenAI usage response: {}", e));
    }

    if is_auth_error(response.status) {
        if let Some(refresh_token_value) = refresh_token {
            if let Ok(refreshed_token) = refresh_access_token(api_keys, refresh_token_value).await {
                let retry_response =
                    fetch_usage_with_token(client, api_keys, &refreshed_token).await?;
                if retry_response.status.is_success() {
                    return serde_json::from_str(&retry_response.text)
                        .map_err(|e| format!("Failed to parse OpenAI usage response: {}", e));
                }
            }
        }
        return Err(OPENAI_OAUTH_EXPIRED_MESSAGE.to_string());
    }

    Err(format!(
        "OpenAI usage request failed ({}): {}",
        response.status, response.text
    ))
}

#[tauri::command]
pub async fn llm_openai_oauth_usage(state: State<'_, LlmState>) -> Result<Value, String> {
    let api_keys = state.api_keys.lock().await;
    fetch_openai_oauth_usage(&api_keys).await
}
