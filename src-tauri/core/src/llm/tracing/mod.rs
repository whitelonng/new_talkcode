// LLM Tracing module
// Provides non-blocking telemetry collection for LLM operations
// Following OpenTelemetry GenAI semantic conventions

pub mod ids;
pub mod schema;
pub mod types;
pub mod writer;

pub use writer::TraceWriter;

#[cfg(test)]
mod tests {
    use super::schema;
    use super::TraceWriter;
    use crate::llm::tracing::types::{attributes, float_attr, int_attr, string_attr};
    use std::collections::HashMap;
    use std::sync::Arc;
    use tempfile::TempDir;

    async fn create_test_setup() -> (TraceWriter, Arc<crate::database::Database>, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_mod.db");
        let db = Arc::new(crate::database::Database::new(
            db_path.to_string_lossy().to_string(),
        ));
        db.connect()
            .await
            .expect("Failed to connect to test database");

        // Initialize schema
        schema::init_tracing_schema(&db).await.unwrap();

        let writer = TraceWriter::new(db.clone());
        writer.start();
        (writer, db, temp_dir)
    }

    struct TestTracingSpan {
        span_id: String,
        writer: TraceWriter,
        closed: bool,
    }

    impl TestTracingSpan {
        fn new(
            writer: &TraceWriter,
            trace_id: String,
            parent_span_id: Option<String>,
            name: String,
            attributes: HashMap<String, serde_json::Value>,
        ) -> Self {
            let span_id = writer.start_span(trace_id, parent_span_id, name, attributes);
            Self {
                span_id,
                writer: writer.clone(),
                closed: false,
            }
        }

        fn span_id(&self) -> &str {
            &self.span_id
        }

        fn add_event(&self, event_type: impl Into<String>, payload: Option<serde_json::Value>) {
            self.writer
                .add_event(self.span_id.clone(), event_type.into(), payload);
        }

        fn close(&mut self) {
            if !self.closed {
                let ended_at = chrono::Utc::now().timestamp_millis();
                self.writer.end_span(self.span_id.clone(), ended_at);
                self.closed = true;
            }
        }
    }

    impl Drop for TestTracingSpan {
        fn drop(&mut self) {
            self.close();
        }
    }

    struct TestTraceBuilder {
        writer: TraceWriter,
        root_span_name: String,
        root_span_attributes: HashMap<String, serde_json::Value>,
    }

    impl TestTraceBuilder {
        fn new(writer: &TraceWriter, root_span_name: impl Into<String>) -> Self {
            Self {
                writer: writer.clone(),
                root_span_name: root_span_name.into(),
                root_span_attributes: HashMap::new(),
            }
        }

        fn with_attribute(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
            self.root_span_attributes.insert(key.into(), value);
            self
        }

        fn build(self) -> TestTracingSpan {
            let trace_id = self.writer.start_trace();
            TestTracingSpan::new(
                &self.writer,
                trace_id,
                None,
                self.root_span_name,
                self.root_span_attributes,
            )
        }
    }

    fn add_request_params(
        attributes: &mut HashMap<String, serde_json::Value>,
        temperature: Option<f32>,
        top_p: Option<f32>,
        top_k: Option<i32>,
        max_tokens: Option<i32>,
    ) {
        if let Some(t) = temperature {
            attributes.insert(
                attributes::GEN_AI_REQUEST_TEMPERATURE.to_string(),
                float_attr(t as f64),
            );
        }
        if let Some(p) = top_p {
            attributes.insert(
                attributes::GEN_AI_REQUEST_TOP_P.to_string(),
                float_attr(p as f64),
            );
        }
        if let Some(k) = top_k {
            attributes.insert(
                attributes::GEN_AI_REQUEST_TOP_K.to_string(),
                int_attr(k as i64),
            );
        }
        if let Some(m) = max_tokens {
            attributes.insert(
                attributes::GEN_AI_REQUEST_MAX_TOKENS.to_string(),
                int_attr(m as i64),
            );
        }
    }

    fn add_error(
        attributes: &mut HashMap<String, serde_json::Value>,
        error_type: impl Into<String>,
        error_message: impl Into<String>,
    ) {
        attributes.insert(attributes::ERROR_TYPE.to_string(), string_attr(error_type));
        attributes.insert("error.message".to_string(), string_attr(error_message));
    }

    #[tokio::test]
    async fn test_tracing_span_lifecycle() {
        let (writer, db, _temp_dir) = create_test_setup().await;

        // Create a span
        let span = TestTracingSpan::new(
            &writer,
            writer.start_trace(),
            None,
            "test.span".to_string(),
            HashMap::new(),
        );

        let span_id = span.span_id().to_string();

        // Add an event
        span.add_event("test.event", Some(serde_json::json!({"data": "value"})));

        // Drop the span to close it
        drop(span);

        // Wait for writes
        writer.request_flush();
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;

        // Verify span exists and is closed
        let result = db
            .query(
                "SELECT id, ended_at FROM spans WHERE id = ?",
                vec![serde_json::Value::String(span_id)],
            )
            .await;
        assert!(result.is_ok());
        let rows = result.unwrap().rows;
        assert_eq!(rows.len(), 1, "Span should exist in database");
        assert!(rows[0]["ended_at"].is_number(), "Span should be closed");
    }

    #[tokio::test]
    async fn test_tracing_span_manual_close() {
        let (writer, db, _temp_dir) = create_test_setup().await;

        let mut span = TestTracingSpan::new(
            &writer,
            writer.start_trace(),
            None,
            "test.span".to_string(),
            HashMap::new(),
        );

        let span_id = span.span_id().to_string();

        // Wait for span creation to complete
        writer.request_flush();
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Manually close
        span.close();
        assert!(span.closed);

        // Wait for close to complete
        writer.request_flush();
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Verify span is closed
        let result = db
            .query(
                "SELECT ended_at FROM spans WHERE id = ?",
                vec![serde_json::Value::String(span_id)],
            )
            .await;
        assert!(result.is_ok());
        let query_result = result.unwrap();
        assert_eq!(query_result.rows.len(), 1, "Span should exist");
        assert!(query_result.rows[0]["ended_at"].is_number());

        // Dropping already-closed span should not panic
        drop(span);
    }

    #[tokio::test]
    async fn test_child_span() {
        let (writer, db, _temp_dir) = create_test_setup().await;

        let parent = TestTracingSpan::new(
            &writer,
            writer.start_trace(),
            None,
            "parent.span".to_string(),
            HashMap::new(),
        );

        let parent_id = parent.span_id().to_string();

        // Create child
        let child = TestTracingSpan::new(
            &writer,
            writer
                .trace_id_for_span(parent.span_id())
                .unwrap_or_default(),
            Some(parent.span_id().to_string()),
            "child.span".to_string(),
            HashMap::new(),
        );

        let child_id = child.span_id().to_string();

        // Drop both
        drop(child);
        drop(parent);

        // Wait for writes
        writer.request_flush();
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;

        // Verify child has correct parent
        let result = db
            .query(
                "SELECT parent_span_id FROM spans WHERE id = ?",
                vec![serde_json::Value::String(child_id.clone())],
            )
            .await;
        assert!(result.is_ok(), "Query should succeed");
        let query_result = result.unwrap();
        assert_eq!(query_result.rows.len(), 1, "Child span should exist");
        assert_eq!(
            query_result.rows[0]["parent_span_id"],
            serde_json::Value::String(parent_id)
        );
    }

    #[tokio::test]
    async fn test_trace_builder() {
        let (writer, db, _temp_dir) = create_test_setup().await;

        let root = TestTraceBuilder::new(&writer, "root.span")
            .with_attribute("custom.key", string_attr("custom.value"))
            .build();

        let span_id = root.span_id().to_string();

        drop(root);

        // Wait for writes
        writer.request_flush();
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Verify span has the attribute
        let result = db
            .query(
                "SELECT attributes FROM spans WHERE id = ?",
                vec![serde_json::Value::String(span_id)],
            )
            .await;
        assert!(result.is_ok());
        let query_result = result.unwrap();
        let attrs_str = query_result.rows[0]["attributes"].as_str().unwrap();
        let attrs: HashMap<String, serde_json::Value> = serde_json::from_str(attrs_str).unwrap();
        assert_eq!(
            attrs.get("custom.key"),
            Some(&serde_json::Value::String("custom.value".to_string()))
        );
    }

    #[tokio::test]
    async fn test_helpers() {
        let (_writer, _db, _temp_dir) = create_test_setup().await;

        // Test add_request_params
        let mut attrs = HashMap::new();
        add_request_params(&mut attrs, Some(0.7), Some(0.9), Some(50), Some(2000));
        assert!(attrs.contains_key("gen_ai.request.temperature"));
        assert!(attrs.contains_key("gen_ai.request.max_tokens"));

        // Test add_error
        let mut attrs = HashMap::new();
        add_error(&mut attrs, "timeout", "Request timed out");
        assert_eq!(
            attrs.get("error.type"),
            Some(&serde_json::Value::String("timeout".to_string()))
        );
    }
}
