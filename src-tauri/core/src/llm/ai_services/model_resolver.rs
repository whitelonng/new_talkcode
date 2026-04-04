use crate::llm::ai_services::types::ModelFallbackInfo;
use crate::llm::auth::api_key_manager::ApiKeyManager;
use crate::llm::models::model_registry::ModelRegistry;
use crate::llm::providers::provider_registry::ProviderRegistry;
use std::cmp::Ordering;

#[derive(Debug, Clone, Copy)]
pub enum FallbackStrategy {
    AnyAvailable,
    Compaction,
}

pub async fn resolve_model_identifier(
    api_keys: &ApiKeyManager,
    registry: &ProviderRegistry,
    preferred: Option<String>,
    strategy: FallbackStrategy,
) -> Result<String, String> {
    if let Some(model) = preferred {
        if let Some(resolved) = try_resolve_model(api_keys, registry, &model).await? {
            return Ok(resolved);
        }
        log::warn!("Preferred model {} is not available, falling back", model);
    }

    match strategy {
        FallbackStrategy::AnyAvailable => resolve_any_available(api_keys, registry).await,
        FallbackStrategy::Compaction => resolve_compaction_fallback(api_keys, registry).await,
    }
}

async fn try_resolve_model(
    api_keys: &ApiKeyManager,
    registry: &ProviderRegistry,
    model_identifier: &str,
) -> Result<Option<String>, String> {
    let models = api_keys.load_models_config().await?;
    let api_map = api_keys.load_api_keys().await?;
    let custom_providers = api_keys.load_custom_providers().await?;

    if models.models.contains_key(model_identifier) {
        if let Ok((model_key, provider_id)) = ModelRegistry::get_model_provider(
            model_identifier,
            &api_map,
            registry,
            &custom_providers,
            &models,
        ) {
            return Ok(Some(format!("{}@{}", model_key, provider_id)));
        }
        return Ok(None);
    }

    if model_identifier.contains('@') {
        let parts: Vec<&str> = model_identifier.split('@').collect();
        if parts.len() == 2 {
            let model_key = parts[0];
            let provider_id = parts[1];
            if models.models.contains_key(model_key) && registry.provider(provider_id).is_some() {
                return Ok(Some(format!("{}@{}", model_key, provider_id)));
            }
        }
        return Ok(None);
    }

    Ok(None)
}

async fn resolve_any_available(
    api_keys: &ApiKeyManager,
    registry: &ProviderRegistry,
) -> Result<String, String> {
    let available = ModelRegistry::compute_available_models(api_keys, registry).await?;
    if let Some(model) = available.first() {
        return Ok(format!("{}@{}", model.key, model.provider));
    }

    Err("No available model for the requested operation".to_string())
}

async fn resolve_compaction_fallback(
    api_keys: &ApiKeyManager,
    registry: &ProviderRegistry,
) -> Result<String, String> {
    let models_config = api_keys.load_models_config().await?;
    let available = ModelRegistry::compute_available_models(api_keys, registry).await?;

    let mut candidates: Vec<ModelFallbackInfo> = available
        .into_iter()
        .map(|model| {
            let context_length = models_config
                .models
                .get(&model.key)
                .and_then(|cfg| cfg.context_length)
                .unwrap_or(0);
            let input_price = model
                .input_pricing
                .as_ref()
                .and_then(|value| value.parse::<f64>().ok())
                .unwrap_or(f64::INFINITY);

            ModelFallbackInfo {
                model_key: model.key,
                provider_id: model.provider,
                context_length,
                input_price,
            }
        })
        .collect();

    candidates.sort_by(|a, b| match b.context_length.cmp(&a.context_length) {
        Ordering::Equal => a
            .input_price
            .partial_cmp(&b.input_price)
            .unwrap_or(Ordering::Equal),
        other => other,
    });

    if let Some(best) = candidates.first() {
        return Ok(format!("{}@{}", best.model_key, best.provider_id));
    }

    Err("No available model for compaction".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;
    use crate::llm::types::{
        AuthType, ModelConfig, ModelPricing, ModelsConfiguration, ProtocolType, ProviderConfig,
    };
    use std::collections::HashMap;
    use std::sync::Arc;
    use tempfile::TempDir;

    async fn setup_context(provider_id: &str) -> (ApiKeyManager, ProviderRegistry) {
        let dir = TempDir::new().expect("temp dir");
        let db_path = dir.path().join("models-test.db");
        let db = Arc::new(Database::new(db_path.to_string_lossy().to_string()));
        db.connect().await.expect("db connect");
        db.execute(
            "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)",
            vec![],
        )
        .await
        .expect("create settings");

        let api_keys = ApiKeyManager::new(db, dir.path().join("app-data"));
        api_keys
            .set_setting(&format!("api_key_{}", provider_id), "test-key")
            .await
            .expect("set api key");

        let provider_config = ProviderConfig {
            id: provider_id.to_string(),
            name: provider_id.to_string(),
            protocol: ProtocolType::OpenAiCompatible,
            base_url: "http://localhost".to_string(),
            api_key_name: "TEST_API_KEY".to_string(),
            supports_oauth: false,
            supports_coding_plan: false,
            supports_international: false,
            coding_plan_base_url: None,
            international_base_url: None,
            headers: None,
            extra_body: None,
            auth_type: AuthType::Bearer,
        };
        let registry = ProviderRegistry::new(vec![provider_config]);

        let models_config = ModelsConfiguration {
            version: "1".to_string(),
            models: HashMap::from([(
                "test-model".to_string(),
                ModelConfig {
                    name: "Test Model".to_string(),
                    image_input: false,
                    image_output: false,
                    audio_input: false,
                    video_input: false,
                    interleaved: false,
                    providers: vec![provider_id.to_string()],
                    provider_mappings: None,
                    pricing: Some(ModelPricing {
                        input: "0.0001".to_string(),
                        output: "0.0002".to_string(),
                        cached_input: None,
                        cache_creation: None,
                    }),
                    context_length: Some(8192),
                },
            )]),
        };

        api_keys
            .set_setting(
                "models_config_json",
                &serde_json::to_string(&models_config).expect("serialize config"),
            )
            .await
            .expect("set models config");

        (api_keys, registry)
    }

    #[tokio::test]
    async fn resolves_preferred_model_when_available() {
        let (api_keys, registry) = setup_context("openai").await;
        let resolved = resolve_model_identifier(
            &api_keys,
            &registry,
            Some("test-model@openai".to_string()),
            FallbackStrategy::AnyAvailable,
        )
        .await
        .expect("resolve model");

        assert_eq!(resolved, "test-model@openai");
    }

    #[tokio::test]
    async fn falls_back_to_any_available_when_preferred_missing() {
        let (api_keys, registry) = setup_context("openai").await;
        let resolved = resolve_model_identifier(
            &api_keys,
            &registry,
            Some("missing-model".to_string()),
            FallbackStrategy::AnyAvailable,
        )
        .await
        .expect("resolve model");

        assert_eq!(resolved, "test-model@openai");
    }
}
