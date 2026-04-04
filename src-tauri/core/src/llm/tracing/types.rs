// Tracing data types for LLM telemetry
// Following OpenTelemetry GenAI semantic conventions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a complete trace of an LLM operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trace {
    /// Unique trace identifier (format: YYYYMMDDhhmmssfff-uuid)
    pub id: String,
    /// Start time in milliseconds since Unix epoch
    pub started_at: i64,
    /// End time in milliseconds since Unix epoch
    pub ended_at: Option<i64>,
    /// Additional metadata as JSON map
    pub metadata: Option<serde_json::Value>,
}

/// Represents a span within a trace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Span {
    /// Unique span identifier (16 hex characters)
    pub id: String,
    /// Parent trace identifier
    pub trace_id: String,
    /// Parent span identifier (None for root spans)
    pub parent_span_id: Option<String>,
    /// Span name (e.g., "llm.stream_completion", "llm.request")
    pub name: String,
    /// Start time in milliseconds since Unix epoch
    pub started_at: i64,
    /// End time in milliseconds since Unix epoch
    pub ended_at: Option<i64>,
    /// Span attributes following OpenTelemetry GenAI conventions
    pub attributes: HashMap<String, serde_json::Value>,
}

/// Represents an event that occurred during a span
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpanEvent {
    /// Unique event identifier
    pub id: String,
    /// Parent span identifier
    pub span_id: String,
    /// Event timestamp in milliseconds since Unix epoch
    pub timestamp: i64,
    /// Event type (e.g., "gen_ai.request.body", "gen_ai.response.body", "error")
    pub event_type: String,
    /// Event payload (JSON value)
    pub payload: Option<serde_json::Value>,
}

/// Commands sent to the trace writer
#[derive(Debug, Clone)]
pub enum TraceCommand {
    /// Create a new trace
    CreateTrace(Trace),
    /// Create a new span
    CreateSpan(Span),
    /// Update span end time
    CloseSpan { span_id: String, ended_at: i64 },
    /// Add an event to a span
    AddEvent(SpanEvent),
    #[cfg(test)]
    /// Flush all pending writes
    Flush,
    /// Shutdown the writer
    Shutdown,
}

/// OpenTelemetry GenAI semantic attribute keys
pub mod attributes {
    // System and model attributes
    pub const GEN_AI_SYSTEM: &str = "gen_ai.system";
    pub const GEN_AI_REQUEST_MODEL: &str = "gen_ai.request.model";

    // Request parameters
    pub const GEN_AI_REQUEST_TEMPERATURE: &str = "gen_ai.request.temperature";
    pub const GEN_AI_REQUEST_TOP_P: &str = "gen_ai.request.top_p";
    pub const GEN_AI_REQUEST_TOP_K: &str = "gen_ai.request.top_k";
    pub const GEN_AI_REQUEST_MAX_TOKENS: &str = "gen_ai.request.max_tokens";

    // HTTP attributes
    pub const HTTP_REQUEST_BODY: &str = "http.request.body";
    pub const HTTP_RESPONSE_BODY: &str = "http.response.body";

    // Error attributes
    pub const ERROR_TYPE: &str = "error.type";

    // Latency attributes
    pub const GEN_AI_TTFT_MS: &str = "gen_ai.ttft_ms";
}

/// Helper functions for building attributes
pub fn string_attr(value: impl Into<String>) -> serde_json::Value {
    serde_json::Value::String(value.into())
}

pub fn int_attr(value: i64) -> serde_json::Value {
    serde_json::Value::Number(value.into())
}

pub fn float_attr(value: f64) -> serde_json::Value {
    serde_json::Number::from_f64(value)
        .map(serde_json::Value::Number)
        .unwrap_or(serde_json::Value::Null)
}

/// Batch size and timing configuration
pub const BATCH_SIZE: usize = 100;
pub const BATCH_TIMEOUT_MS: u64 = 50;
pub const CHANNEL_CAPACITY: usize = 10000;

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_trace_creation() {
        let trace = Trace {
            id: "20260130123456789-abc12345".to_string(),
            started_at: 1706611200000,
            ended_at: None,
            metadata: None,
        };

        assert_eq!(trace.id, "20260130123456789-abc12345");
        assert_eq!(trace.started_at, 1706611200000);
        assert!(trace.ended_at.is_none());
    }

    #[test]
    fn test_span_creation() {
        let mut attributes = HashMap::new();
        attributes.insert(
            attributes::GEN_AI_REQUEST_MODEL.to_string(),
            string_attr("gpt-4"),
        );
        attributes.insert(
            attributes::GEN_AI_REQUEST_MAX_TOKENS.to_string(),
            int_attr(100),
        );

        let span = Span {
            id: "a1b2c3d4e5f67890".to_string(),
            trace_id: "20260130123456789-abc12345".to_string(),
            parent_span_id: None,
            name: "llm.stream_completion".to_string(),
            started_at: 1706611200000,
            ended_at: None,
            attributes,
        };

        assert_eq!(span.id.len(), 16);
        assert_eq!(span.name, "llm.stream_completion");
        assert!(span.attributes.contains_key("gen_ai.request.model"));
    }

    #[test]
    fn test_span_event_creation() {
        let payload = serde_json::json!({
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Hello"}]
        });

        let event = SpanEvent {
            id: "event-123".to_string(),
            span_id: "a1b2c3d4e5f67890".to_string(),
            timestamp: 1706611200000,
            event_type: attributes::HTTP_REQUEST_BODY.to_string(),
            payload: Some(payload),
        };

        assert_eq!(event.event_type, "http.request.body");
        assert!(event.payload.is_some());
    }

    #[test]
    fn test_attribute_helpers() {
        assert_eq!(
            string_attr("test"),
            serde_json::Value::String("test".to_string())
        );
        assert_eq!(int_attr(42), serde_json::Value::Number(42.into()));
    }
}
