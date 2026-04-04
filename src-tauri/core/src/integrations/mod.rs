//! Integration Layer
//!
//! IM adapters for Telegram, Feishu, and future channels (Slack, Discord, WhatsApp).
//! Wraps existing gateway implementations for cloud backend integration.

pub mod feishu;
pub mod telegram;
pub mod types;

pub use feishu::{FeishuAdapter, FeishuConfig};
pub use telegram::{TelegramAdapter, TelegramConfig};
pub use types::*;

/// Integration factory for creating adapters
pub struct IntegrationFactory;

impl IntegrationFactory {
    /// Create a Telegram adapter
    pub fn create_telegram(id: impl Into<IntegrationId>, bot_token: String) -> TelegramAdapter {
        TelegramAdapter::new(
            id,
            TelegramConfig {
                bot_token,
                webhook_url: None,
            },
        )
    }

    /// Create a Feishu adapter
    pub fn create_feishu(
        id: impl Into<IntegrationId>,
        app_id: String,
        app_secret: String,
    ) -> FeishuAdapter {
        FeishuAdapter::new(
            id,
            FeishuConfig {
                app_id,
                app_secret,
                webhook_url: None,
            },
        )
    }

    /// Create adapters from existing gateway state
    /// This connects to the existing telegram_gateway and feishu_gateway modules
    pub fn from_existing_state(_app_handle: &tauri::AppHandle) -> IntegrationManager {
        let mut manager = IntegrationManager::new();

        // Note: In production, this would check for existing gateway states
        // and create adapters connected to them. For now, we create fresh adapters.

        // Create telegram adapter
        let telegram_adapter = TelegramAdapter::from_gateway("telegram");
        manager.register_adapter(Box::new(telegram_adapter));

        // Create feishu adapter
        let feishu_adapter = FeishuAdapter::from_gateway("feishu");
        manager.register_adapter(Box::new(feishu_adapter));

        manager
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_integration_factory() {
        let telegram = IntegrationFactory::create_telegram("tg-1", "token123".to_string());
        assert_eq!(telegram.id(), "tg-1");

        let feishu =
            IntegrationFactory::create_feishu("fs-1", "app_id".to_string(), "secret".to_string());
        assert_eq!(feishu.id(), "fs-1");
    }

    #[test]
    fn test_integration_manager() {
        let mut manager = IntegrationManager::new();

        let telegram = IntegrationFactory::create_telegram("tg-1", "token".to_string());
        manager.register_adapter(Box::new(telegram));

        assert!(manager.get_adapter("tg-1").is_some());
        assert!(manager.get_adapter("nonexistent").is_none());
    }
}
