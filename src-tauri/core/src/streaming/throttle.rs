//! Event Throttling
//!
//! Throttles streaming events to match desktop behavior:
//! - Edit updates at ~1s cadence
//! - Token streaming with debouncing
//! - Message length caps

use crate::streaming::events::StreamingEvent;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Throttling configuration
#[derive(Debug, Clone)]
pub struct ThrottleConfig {
    /// Minimum interval between token events
    pub token_interval: Duration,
    /// Minimum interval between status events
    pub status_interval: Duration,
    /// Maximum message length before truncation
    pub max_message_length: usize,
    /// Debounce duration for aggregating tokens
    pub debounce_duration: Duration,
}

impl Default for ThrottleConfig {
    fn default() -> Self {
        Self {
            token_interval: Duration::from_millis(50), // 20 tokens/sec max
            status_interval: Duration::from_secs(1),
            max_message_length: 100_000,
            debounce_duration: Duration::from_millis(100),
        }
    }
}

/// Event throttler for streaming
pub struct EventThrottler {
    config: ThrottleConfig,
    /// Last event time per session and event type
    last_event_times: RwLock<HashMap<(String, String), Instant>>,
    /// Accumulated tokens per session for debouncing
    token_buffers: RwLock<HashMap<String, String>>,
}

impl EventThrottler {
    pub fn new(config: ThrottleConfig) -> Self {
        Self {
            config,
            last_event_times: RwLock::new(HashMap::new()),
            token_buffers: RwLock::new(HashMap::new()),
        }
    }

    /// Check if an event should be throttled
    pub async fn should_throttle(&self, event: &StreamingEvent) -> bool {
        let session_id = event.session_id().map(|s| s.as_str()).unwrap_or("global");
        let event_type = format!("{:?}", event.event_type());
        let key = (session_id.to_string(), event_type);

        let interval = match event {
            StreamingEvent::Token { .. } => self.config.token_interval,
            StreamingEvent::Status { .. } => self.config.status_interval,
            _ => Duration::ZERO, // No throttling for other events
        };

        if interval == Duration::ZERO {
            return false;
        }

        let mut times = self.last_event_times.write().await;
        let now = Instant::now();

        if let Some(last_time) = times.get(&key) {
            if now.duration_since(*last_time) < interval {
                return true; // Throttle
            }
        }

        // Update last event time
        times.insert(key, now);
        false
    }

    /// Accumulate tokens for debouncing
    pub async fn accumulate_token(&self, session_id: &str, token: &str) -> Option<String> {
        let mut buffers = self.token_buffers.write().await;
        let buffer = buffers
            .entry(session_id.to_string())
            .or_insert_with(String::new);

        buffer.push_str(token);

        // Check if we should flush
        if buffer.len() >= 10 || self.config.debounce_duration == Duration::ZERO {
            let result = buffer.clone();
            buffer.clear();
            return Some(result);
        }

        None
    }

    /// Flush accumulated tokens for a session
    pub async fn flush_tokens(&self, session_id: &str) -> Option<String> {
        let mut buffers = self.token_buffers.write().await;
        buffers.remove(session_id).filter(|s| !s.is_empty())
    }

    /// Apply message length cap
    pub fn cap_message_length(&self, message: &str) -> String {
        if message.len() > self.config.max_message_length {
            let mut result = message[..self.config.max_message_length].to_string();
            result.push_str("\n... [truncated]");
            result
        } else {
            message.to_string()
        }
    }

    /// Clear state for a session
    pub async fn clear_session(&self, session_id: &str) {
        let mut times = self.last_event_times.write().await;
        let keys_to_remove: Vec<_> = times
            .keys()
            .filter(|(sid, _)| sid == session_id)
            .cloned()
            .collect();
        for key in keys_to_remove {
            times.remove(&key);
        }

        let mut buffers = self.token_buffers.write().await;
        buffers.remove(session_id);
    }
}

impl Default for EventThrottler {
    fn default() -> Self {
        Self::new(ThrottleConfig::default())
    }
}

/// Streaming manager that coordinates buffer and throttler
pub struct StreamingManager {
    pub buffer: crate::streaming::buffer::EventBuffer,
    pub throttler: EventThrottler,
}

impl StreamingManager {
    pub fn new() -> Self {
        Self {
            buffer: crate::streaming::buffer::EventBuffer::new(1000),
            throttler: EventThrottler::default(),
        }
    }

    pub fn with_buffer_capacity(mut self, capacity: usize) -> Self {
        self.buffer = crate::streaming::buffer::EventBuffer::new(capacity);
        self
    }

    pub fn with_throttle_config(mut self, config: ThrottleConfig) -> Self {
        self.throttler = EventThrottler::new(config);
        self
    }
}

impl Default for StreamingManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_throttle_config() {
        let config = ThrottleConfig::default();
        assert_eq!(config.token_interval, Duration::from_millis(50));
    }

    #[tokio::test]
    async fn test_token_accumulation() {
        let throttler = EventThrottler::default();

        // Accumulate tokens (total 9 chars, under 10 char threshold)
        let result1 = throttler.accumulate_token("sess-1", "Hi ").await;
        assert!(result1.is_none());

        let result2 = throttler.accumulate_token("sess-1", "there").await;
        assert!(result2.is_none()); // Not enough tokens yet (8 chars total)

        // Flush manually
        let flushed = throttler.flush_tokens("sess-1").await;
        assert_eq!(flushed, Some("Hi there".to_string()));
    }

    #[test]
    fn test_message_length_cap() {
        let throttler = EventThrottler::default();

        let short_message = "Short message";
        assert_eq!(throttler.cap_message_length(short_message), short_message);

        let long_message = "x".repeat(200_000);
        let capped = throttler.cap_message_length(&long_message);
        assert!(capped.len() < long_message.len());
        assert!(capped.ends_with("[truncated]"));
    }
}
