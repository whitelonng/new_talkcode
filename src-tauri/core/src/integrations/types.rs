//! Integration Types
//!
//! Shared types for IM integrations (Telegram, Feishu, etc.)

use serde::{Deserialize, Serialize};

/// Unique identifier for an integration adapter
pub type IntegrationId = String;

/// Supported integration channels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChannelType {
    Telegram,
    Feishu,
    Slack,
    Discord,
    WhatsApp,
}

impl ChannelType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ChannelType::Telegram => "telegram",
            ChannelType::Feishu => "feishu",
            ChannelType::Slack => "slack",
            ChannelType::Discord => "discord",
            ChannelType::WhatsApp => "whatsapp",
        }
    }
}

/// Integration adapter trait
#[async_trait::async_trait]
pub trait IntegrationAdapter: Send + Sync {
    /// Get the integration ID
    fn id(&self) -> &IntegrationId;

    /// Get the channel type
    fn channel_type(&self) -> ChannelType;

    /// Start the integration (connect, start listening)
    async fn start(&self) -> Result<(), String>;

    /// Stop the integration
    async fn stop(&self) -> Result<(), String>;

    /// Send a message to a channel/user
    async fn send_message(&self, recipient: &str, content: &str) -> Result<MessageId, String>;

    /// Edit a previously sent message
    async fn edit_message(
        &self,
        recipient: &str,
        message_id: &str,
        new_content: &str,
    ) -> Result<(), String>;

    /// Check if the integration is connected
    async fn is_connected(&self) -> bool;
}

/// Message ID type
pub type MessageId = String;

/// Incoming message from an integration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingMessage {
    pub integration_id: IntegrationId,
    pub channel_type: ChannelType,
    pub sender_id: String,
    pub sender_name: Option<String>,
    pub chat_id: String,
    pub message_id: MessageId,
    pub content: String,
    pub timestamp: i64,
    pub reply_to: Option<MessageId>,
}

/// Outgoing message to an integration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutgoingMessage {
    pub recipient: String,
    pub content: String,
    pub reply_to: Option<MessageId>,
    pub edit_message_id: Option<MessageId>,
}

/// Integration configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationConfig {
    pub id: IntegrationId,
    pub channel_type: ChannelType,
    pub enabled: bool,
    pub settings: serde_json::Value,
}

/// Integration manager handles all adapters
pub struct IntegrationManager {
    adapters: std::collections::HashMap<IntegrationId, Box<dyn IntegrationAdapter>>,
}

impl IntegrationManager {
    pub fn new() -> Self {
        Self {
            adapters: std::collections::HashMap::new(),
        }
    }

    /// Register an adapter
    pub fn register_adapter(&mut self, adapter: Box<dyn IntegrationAdapter>) {
        self.adapters.insert(adapter.id().clone(), adapter);
    }

    /// Get an adapter by ID
    pub fn get_adapter(&self, id: &str) -> Option<&dyn IntegrationAdapter> {
        self.adapters.get(id).map(|b| b.as_ref())
    }

    /// Start all adapters
    pub async fn start_all(&self) -> Vec<(IntegrationId, Result<(), String>)> {
        let mut results = Vec::new();
        for (id, adapter) in &self.adapters {
            results.push((id.clone(), adapter.start().await));
        }
        results
    }

    /// Stop all adapters
    pub async fn stop_all(&self) -> Vec<(IntegrationId, Result<(), String>)> {
        let mut results = Vec::new();
        for (id, adapter) in &self.adapters {
            results.push((id.clone(), adapter.stop().await));
        }
        results
    }
}

impl Default for IntegrationManager {
    fn default() -> Self {
        Self::new()
    }
}
