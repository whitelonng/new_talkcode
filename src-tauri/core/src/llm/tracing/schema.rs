// Database schema for LLM tracing
// Creates tables for traces, spans, and span events

#[cfg(test)]
use std::sync::Arc;

#[cfg(test)]
use crate::database::Database;

/// Initializes the tracing database schema
/// Creates tables and indexes if they don't exist
#[cfg(test)]
pub async fn init_tracing_schema(db: &Arc<Database>) -> Result<(), String> {
    // Create tables
    db.execute(
        "CREATE TABLE IF NOT EXISTS traces (id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, ended_at INTEGER, metadata TEXT)",
        vec![],
    )
    .await?;
    db.execute(
        "CREATE TABLE IF NOT EXISTS spans (id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, parent_span_id TEXT, name TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, attributes TEXT, FOREIGN KEY (trace_id) REFERENCES traces(id) ON DELETE CASCADE, FOREIGN KEY (parent_span_id) REFERENCES spans(id) ON DELETE SET NULL)",
        vec![],
    )
    .await?;
    db.execute(
        "CREATE TABLE IF NOT EXISTS span_events (id TEXT PRIMARY KEY, span_id TEXT NOT NULL, timestamp INTEGER NOT NULL, event_type TEXT NOT NULL, payload TEXT, FOREIGN KEY (span_id) REFERENCES spans(id) ON DELETE CASCADE)",
        vec![],
    )
    .await?;

    // Create indexes for efficient querying
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id)",
        vec![],
    )
    .await?;
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_spans_parent_span_id ON spans(parent_span_id)",
        vec![],
    )
    .await?;
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_span_events_span_id ON span_events(span_id)",
        vec![],
    )
    .await?;
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_traces_started_at ON traces(started_at DESC)",
        vec![],
    )
    .await?;
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_spans_started_at ON spans(started_at DESC)",
        vec![],
    )
    .await?;
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_span_events_timestamp ON span_events(timestamp DESC)",
        vec![],
    )
    .await?;
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_span_events_type ON span_events(event_type)",
        vec![],
    )
    .await?;

    log::info!("LLM tracing schema initialized successfully");
    Ok(())
}

/// SQL queries for trace operations
pub mod queries {
    /// Insert a new trace (ignores if already exists)
    pub const INSERT_TRACE: &str =
        "INSERT OR IGNORE INTO traces (id, started_at, ended_at, metadata) VALUES (?, ?, ?, ?)";

    /// Insert a new span
    pub const INSERT_SPAN: &str = "INSERT INTO spans (id, trace_id, parent_span_id, name, started_at, ended_at, attributes) VALUES (?, ?, ?, ?, ?, ?, ?)";

    /// Update span end time
    pub const CLOSE_SPAN: &str = "UPDATE spans SET ended_at = ? WHERE id = ?";

    /// Insert a new span event
    pub const INSERT_SPAN_EVENT: &str =
        "INSERT INTO span_events (id, span_id, timestamp, event_type, payload) VALUES (?, ?, ?, ?, ?)";
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tempfile::TempDir;

    async fn create_test_db() -> (Arc<Database>, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_tracing.db");
        let db = Arc::new(Database::new(db_path.to_string_lossy().to_string()));
        db.connect()
            .await
            .expect("Failed to connect to test database");
        (db, temp_dir)
    }

    #[tokio::test]
    async fn test_init_tracing_schema() {
        let (db, _temp_dir) = create_test_db().await;

        // Initialize schema
        let result = init_tracing_schema(&db).await;
        assert!(result.is_ok(), "Schema initialization should succeed");

        // Verify tables exist by inserting test data
        let trace_id = "20260130123456789-test1234";
        let insert_result = db
            .execute(
                queries::INSERT_TRACE,
                vec![
                    serde_json::Value::String(trace_id.to_string()),
                    serde_json::Value::Number(1706611200000i64.into()),
                    serde_json::Value::Null,
                    serde_json::Value::Null,
                ],
            )
            .await;
        assert!(insert_result.is_ok(), "Should be able to insert trace");

        // Verify span table exists
        let span_id = "a1b2c3d4e5f67890";
        let span_result = db
            .execute(
                queries::INSERT_SPAN,
                vec![
                    serde_json::Value::String(span_id.to_string()),
                    serde_json::Value::String(trace_id.to_string()),
                    serde_json::Value::Null,
                    serde_json::Value::String("test.span".to_string()),
                    serde_json::Value::Number(1706611200000i64.into()),
                    serde_json::Value::Null,
                    serde_json::Value::String("{}".to_string()),
                ],
            )
            .await;
        assert!(span_result.is_ok(), "Should be able to insert span");

        // Verify span events table exists
        let event_id = "event1234567890";
        let event_result = db
            .execute(
                queries::INSERT_SPAN_EVENT,
                vec![
                    serde_json::Value::String(event_id.to_string()),
                    serde_json::Value::String(span_id.to_string()),
                    serde_json::Value::Number(1706611200000i64.into()),
                    serde_json::Value::String("test.event".to_string()),
                    serde_json::Value::Null,
                ],
            )
            .await;
        assert!(event_result.is_ok(), "Should be able to insert span event");
    }

    #[tokio::test]
    async fn test_schema_idempotent() {
        let (db, _temp_dir) = create_test_db().await;

        // Initialize schema multiple times - should not fail
        let result1 = init_tracing_schema(&db).await;
        assert!(result1.is_ok());

        let result2 = init_tracing_schema(&db).await;
        assert!(result2.is_ok());

        let result3 = init_tracing_schema(&db).await;
        assert!(result3.is_ok());
    }

    #[tokio::test]
    async fn test_close_span() {
        let (db, _temp_dir) = create_test_db().await;
        init_tracing_schema(&db).await.unwrap();

        // Insert a trace and span
        let trace_id = "20260130123456789-test1234";
        let span_id = "a1b2c3d4e5f67890";

        db.execute(
            queries::INSERT_TRACE,
            vec![
                serde_json::Value::String(trace_id.to_string()),
                serde_json::Value::Number(1706611200000i64.into()),
                serde_json::Value::Null,
                serde_json::Value::Null,
            ],
        )
        .await
        .unwrap();

        db.execute(
            queries::INSERT_SPAN,
            vec![
                serde_json::Value::String(span_id.to_string()),
                serde_json::Value::String(trace_id.to_string()),
                serde_json::Value::Null,
                serde_json::Value::String("test.span".to_string()),
                serde_json::Value::Number(1706611200000i64.into()),
                serde_json::Value::Null,
                serde_json::Value::String("{}".to_string()),
            ],
        )
        .await
        .unwrap();

        // Close the span
        let close_result = db
            .execute(
                queries::CLOSE_SPAN,
                vec![
                    serde_json::Value::Number(1706611201000i64.into()),
                    serde_json::Value::String(span_id.to_string()),
                ],
            )
            .await;
        assert!(close_result.is_ok(), "Should be able to close span");
        assert_eq!(close_result.unwrap().rows_affected, 1);

        // Verify span was updated
        let query_result = db
            .query(
                "SELECT ended_at FROM spans WHERE id = ?",
                vec![serde_json::Value::String(span_id.to_string())],
            )
            .await
            .unwrap();
        assert_eq!(query_result.rows.len(), 1);
        assert_eq!(
            query_result.rows[0]["ended_at"],
            serde_json::Value::Number(1706611201000i64.into())
        );
    }
}
