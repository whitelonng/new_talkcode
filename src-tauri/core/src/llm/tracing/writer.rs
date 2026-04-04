// Async trace writer with non-blocking channel and batching
// Ensures stream processing never waits for database writes

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tokio::time::interval;

use crate::database::Database;

use super::{
    ids::{generate_event_id, generate_span_id, generate_trace_id},
    schema::queries,
    types::{Span, SpanEvent, Trace, TraceCommand, BATCH_SIZE, BATCH_TIMEOUT_MS, CHANNEL_CAPACITY},
};

/// Async trace writer that batches writes to the database
/// Uses a channel for non-blocking operation
pub struct TraceWriter {
    sender: mpsc::Sender<TraceCommand>,
    db: Arc<Database>,
    receiver: Arc<Mutex<Option<mpsc::Receiver<TraceCommand>>>>,
    span_trace_ids: Arc<std::sync::Mutex<std::collections::HashMap<String, String>>>,
}

impl TraceWriter {
    /// Creates a new TraceWriter without starting the background task.
    /// Call `start()` to spawn the background processing task.
    pub fn new(db: Arc<Database>) -> Self {
        let (sender, receiver) = mpsc::channel::<TraceCommand>(CHANNEL_CAPACITY);

        Self {
            sender,
            db,
            receiver: Arc::new(Mutex::new(Some(receiver))),
            span_trace_ids: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        }
    }

    /// Starts the background processing task.
    /// Must be called from within a Tokio runtime context.
    pub fn start(&self) {
        let db = self.db.clone();
        let receiver_guard = self.receiver.clone();

        tokio::spawn(async move {
            let receiver = receiver_guard.lock().await.take();
            if let Some(rx) = receiver {
                Self::run_writer(db, rx).await;
            } else {
                log::warn!("TraceWriter::start() called but receiver already taken");
            }
        });
    }

    /// Background task that processes commands and batches writes
    async fn run_writer(db: Arc<Database>, mut receiver: mpsc::Receiver<TraceCommand>) {
        let mut batch: Vec<TraceCommand> = Vec::with_capacity(BATCH_SIZE);
        let mut flush_interval = interval(Duration::from_millis(BATCH_TIMEOUT_MS));

        log::info!("TraceWriter background task started");

        loop {
            tokio::select! {
                // Process incoming commands
                Some(cmd) = receiver.recv() => {
                    match cmd {
                        #[cfg(test)]
                        TraceCommand::Flush => {
                            if !batch.is_empty() {
                                Self::flush_batch(&db, &mut batch).await;
                            }
                        }
                        TraceCommand::Shutdown => {
                            log::info!("TraceWriter received shutdown command, flushing remaining {} items", batch.len());
                            if !batch.is_empty() {
                                Self::flush_batch(&db, &mut batch).await;
                            }
                            log::info!("TraceWriter shutdown complete");
                            break;
                        }
                        other => {
                            batch.push(other);
                            if batch.len() >= BATCH_SIZE {
                                Self::flush_batch(&db, &mut batch).await;
                            }
                        }
                    }
                }

                // Flush on timeout
                _ = flush_interval.tick() => {
                    if !batch.is_empty() {
                        Self::flush_batch(&db, &mut batch).await;
                    }
                }

                // Channel closed
                else => {
                    log::info!("TraceWriter channel closed, flushing remaining {} items", batch.len());
                    if !batch.is_empty() {
                        Self::flush_batch(&db, &mut batch).await;
                    }
                    break;
                }
            }
        }
    }

    /// Flush a batch of commands to the database
    /// Ensures CreateTrace commands are executed first to satisfy foreign key constraints
    async fn flush_batch(db: &Arc<Database>, batch: &mut Vec<TraceCommand>) {
        if batch.is_empty() {
            return;
        }

        // Separate commands by type to ensure proper execution order
        // CreateTrace must come before CreateSpan to satisfy FK constraints
        let mut trace_inserts: Vec<(String, Vec<serde_json::Value>)> = Vec::new();
        let mut span_inserts: Vec<(String, Vec<serde_json::Value>)> = Vec::new();
        let mut span_closes: Vec<(String, Vec<serde_json::Value>)> = Vec::new();
        let mut span_events: Vec<(String, Vec<serde_json::Value>)> = Vec::new();

        for cmd in batch.drain(..) {
            match cmd {
                TraceCommand::CreateTrace(trace) => {
                    trace_inserts.push((
                        queries::INSERT_TRACE.to_string(),
                        vec![
                            serde_json::Value::String(trace.id),
                            serde_json::Value::Number(trace.started_at.into()),
                            trace
                                .ended_at
                                .map(|v| serde_json::Value::Number(v.into()))
                                .unwrap_or(serde_json::Value::Null),
                            trace.metadata.unwrap_or(serde_json::Value::Null),
                        ],
                    ));
                }
                TraceCommand::CreateSpan(span) => {
                    let attributes = serde_json::to_string(&span.attributes)
                        .unwrap_or_else(|_| "{}".to_string());
                    span_inserts.push((
                        queries::INSERT_SPAN.to_string(),
                        vec![
                            serde_json::Value::String(span.id),
                            serde_json::Value::String(span.trace_id),
                            span.parent_span_id
                                .map(serde_json::Value::String)
                                .unwrap_or(serde_json::Value::Null),
                            serde_json::Value::String(span.name),
                            serde_json::Value::Number(span.started_at.into()),
                            span.ended_at
                                .map(|v| serde_json::Value::Number(v.into()))
                                .unwrap_or(serde_json::Value::Null),
                            serde_json::Value::String(attributes),
                        ],
                    ));
                }
                TraceCommand::CloseSpan { span_id, ended_at } => {
                    span_closes.push((
                        queries::CLOSE_SPAN.to_string(),
                        vec![
                            serde_json::Value::Number(ended_at.into()),
                            serde_json::Value::String(span_id),
                        ],
                    ));
                }
                TraceCommand::AddEvent(event) => {
                    span_events.push((
                        queries::INSERT_SPAN_EVENT.to_string(),
                        vec![
                            serde_json::Value::String(event.id),
                            serde_json::Value::String(event.span_id),
                            serde_json::Value::Number(event.timestamp.into()),
                            serde_json::Value::String(event.event_type),
                            event.payload.unwrap_or(serde_json::Value::Null),
                        ],
                    ));
                }
                _ => {} // Flush and Shutdown are handled separately
            }
        }

        // Execute in order: traces first, then spans, then events, then closes
        // This ensures FK constraints are satisfied
        let mut statements: Vec<(String, Vec<serde_json::Value>)> = Vec::new();
        statements.extend(trace_inserts);
        statements.extend(span_inserts);
        statements.extend(span_events);
        statements.extend(span_closes);

        // Execute batch
        if !statements.is_empty() {
            match db.batch(statements).await {
                Ok(_) => {
                    // Batch write successful
                }
                Err(e) => {
                    log::error!("TraceWriter batch write failed: {}", e);
                }
            }
        }
    }

    /// Start a new trace and return its ID
    /// This is non-blocking - the trace is queued for writing
    pub fn start_trace(&self) -> String {
        let trace_id = generate_trace_id();
        let now = chrono::Utc::now().timestamp_millis();

        let trace = Trace {
            id: trace_id.clone(),
            started_at: now,
            ended_at: None,
            metadata: None,
        };

        // Non-blocking send - if channel is full, we drop the trace
        match self.sender.try_send(TraceCommand::CreateTrace(trace)) {
            Ok(_) => {}
            Err(mpsc::error::TrySendError::Full(_)) => {
                log::warn!("TraceWriter channel full, dropping trace creation");
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                log::error!("TraceWriter channel closed");
            }
        }

        trace_id
    }

    /// Start a new span and return its ID
    /// If ensure_trace_exists is true, creates the trace if it doesn't exist
    pub fn start_span(
        &self,
        trace_id: String,
        parent_span_id: Option<String>,
        name: String,
        attributes: std::collections::HashMap<String, serde_json::Value>,
    ) -> String {
        self.start_span_with_trace(trace_id, parent_span_id, name, attributes, true)
    }

    /// Start a new span with optional trace creation
    pub fn start_span_with_trace(
        &self,
        trace_id: String,
        parent_span_id: Option<String>,
        name: String,
        attributes: std::collections::HashMap<String, serde_json::Value>,
        ensure_trace_exists: bool,
    ) -> String {
        let span_id = generate_span_id();
        let now = chrono::Utc::now().timestamp_millis();

        // Create trace if it doesn't exist (for external trace IDs like taskId)
        if ensure_trace_exists {
            self.ensure_trace_exists(trace_id.clone(), now);
        }

        let span = Span {
            id: span_id.clone(),
            trace_id: trace_id.clone(),
            parent_span_id,
            name,
            started_at: now,
            ended_at: None,
            attributes,
        };

        self.span_trace_ids
            .lock()
            .expect("span trace map")
            .insert(span_id.clone(), trace_id);

        match self.sender.try_send(TraceCommand::CreateSpan(span)) {
            Ok(_) => {}
            Err(mpsc::error::TrySendError::Full(_)) => {
                log::warn!("TraceWriter channel full, dropping span creation");
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                log::error!("TraceWriter channel closed");
            }
        }

        span_id
    }

    /// Ensure a trace exists in the database
    /// Uses INSERT OR IGNORE to handle race conditions gracefully
    fn ensure_trace_exists(&self, trace_id: String, started_at: i64) {
        let trace = Trace {
            id: trace_id,
            started_at,
            ended_at: None,
            metadata: None,
        };

        match self.sender.try_send(TraceCommand::CreateTrace(trace)) {
            Ok(_) => {}
            Err(mpsc::error::TrySendError::Full(_)) => {
                log::warn!("TraceWriter channel full, dropping trace creation");
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                log::error!("TraceWriter channel closed");
            }
        }
    }

    pub fn has_span_id(&self, span_id: &str) -> bool {
        self.span_trace_ids
            .lock()
            .expect("span trace map")
            .contains_key(span_id)
    }

    #[cfg(test)]
    pub fn trace_id_for_span(&self, span_id: &str) -> Option<String> {
        self.span_trace_ids
            .lock()
            .expect("span trace map")
            .get(span_id)
            .cloned()
    }

    /// End a span by updating its ended_at timestamp
    pub fn end_span(&self, span_id: String, ended_at: i64) {
        self.span_trace_ids
            .lock()
            .expect("span trace map")
            .remove(&span_id);

        match self
            .sender
            .try_send(TraceCommand::CloseSpan { span_id, ended_at })
        {
            Ok(_) => {}
            Err(mpsc::error::TrySendError::Full(_)) => {
                log::warn!("TraceWriter channel full, dropping span close");
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                log::error!("TraceWriter channel closed");
            }
        }
    }

    /// Add an event to a span
    pub fn add_event(
        &self,
        span_id: String,
        event_type: String,
        payload: Option<serde_json::Value>,
    ) {
        let event_id = generate_event_id();
        let now = chrono::Utc::now().timestamp_millis();

        let event = SpanEvent {
            id: event_id,
            span_id,
            timestamp: now,
            event_type,
            payload,
        };

        match self.sender.try_send(TraceCommand::AddEvent(event)) {
            Ok(_) => {}
            Err(mpsc::error::TrySendError::Full(_)) => {
                log::warn!("TraceWriter channel full, dropping event");
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                log::error!("TraceWriter channel closed");
            }
        }
    }

    #[cfg(test)]
    /// Request a flush of all pending writes
    /// This is best-effort and non-blocking
    pub fn request_flush(&self) {
        #[cfg(test)]
        {
            match self.sender.try_send(TraceCommand::Flush) {
                Ok(_) => {}
                Err(e) => {
                    log::debug!("Failed to send flush command: {:?}", e);
                }
            }
        }
    }

    /// Shutdown the writer gracefully (blocking version for sync contexts)
    /// This creates a new runtime to execute the async shutdown
    pub fn shutdown_blocking(&self) {
        match tokio::runtime::Handle::try_current() {
            Ok(handle) => {
                // We're in an async context, block on shutdown
                let sender = self.sender.clone();
                handle.block_on(async move {
                    match sender.send(TraceCommand::Shutdown).await {
                        Ok(_) => {
                            tokio::time::sleep(Duration::from_millis(100)).await;
                            log::info!("TraceWriter shutdown complete");
                        }
                        Err(e) => {
                            log::error!("Failed to send shutdown command: {:?}", e);
                        }
                    }
                });
            }
            Err(_) => {
                // No async runtime available, try creating one
                if let Ok(rt) = tokio::runtime::Runtime::new() {
                    let sender = self.sender.clone();
                    rt.block_on(async move {
                        match sender.send(TraceCommand::Shutdown).await {
                            Ok(_) => {
                                tokio::time::sleep(Duration::from_millis(100)).await;
                                log::info!("TraceWriter shutdown complete (new runtime)");
                            }
                            Err(e) => {
                                log::error!("Failed to send shutdown command: {:?}", e);
                            }
                        }
                    });
                } else {
                    log::error!("Failed to create tokio runtime for TraceWriter shutdown");
                }
            }
        }
    }
}

impl Clone for TraceWriter {
    fn clone(&self) -> Self {
        Self {
            sender: self.sender.clone(),
            db: self.db.clone(),
            receiver: self.receiver.clone(),
            span_trace_ids: self.span_trace_ids.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tempfile::TempDir;

    async fn create_test_writer() -> (TraceWriter, Arc<Database>, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_writer.db");
        let db = Arc::new(Database::new(db_path.to_string_lossy().to_string()));
        db.connect()
            .await
            .expect("Failed to connect to test database");

        // Initialize schema
        super::super::schema::init_tracing_schema(&db)
            .await
            .unwrap();

        let writer = TraceWriter::new(db.clone());
        writer.start();
        (writer, db, temp_dir)
    }

    #[tokio::test]
    async fn test_start_trace() {
        let (writer, db, _temp_dir) = create_test_writer().await;

        let trace_id = writer.start_trace();
        assert!(!trace_id.is_empty());

        // Wait for the write to complete
        writer.request_flush();
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Verify trace was written
        let result = db
            .query(
                "SELECT id FROM traces WHERE id = ?",
                vec![serde_json::Value::String(trace_id.clone())],
            )
            .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().rows.len(), 1);
    }

    #[tokio::test]
    async fn test_start_and_end_span() {
        let (writer, db, _temp_dir) = create_test_writer().await;

        // Create a trace first
        let trace_id = writer.start_trace();

        // Create a span
        let attributes = HashMap::new();
        let span_id =
            writer.start_span(trace_id.clone(), None, "test.span".to_string(), attributes);

        // Wait for writes
        writer.request_flush();
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Verify span was written
        let result = db
            .query(
                "SELECT id FROM spans WHERE id = ?",
                vec![serde_json::Value::String(span_id.clone())],
            )
            .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().rows.len(), 1);

        // End the span
        let end_time = chrono::Utc::now().timestamp_millis();
        writer.end_span(span_id.clone(), end_time);

        // Wait for write
        writer.request_flush();
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Verify span was closed
        let result = db
            .query(
                "SELECT ended_at FROM spans WHERE id = ?",
                vec![serde_json::Value::String(span_id)],
            )
            .await;
        assert!(result.is_ok());
        let rows = result.unwrap().rows;
        assert_eq!(rows.len(), 1);
        assert_eq!(
            rows[0]["ended_at"],
            serde_json::Value::Number(end_time.into())
        );
    }

    #[tokio::test]
    async fn test_add_event() {
        let (writer, db, _temp_dir) = create_test_writer().await;

        let trace_id = writer.start_trace();
        let attributes = HashMap::new();
        let span_id =
            writer.start_span(trace_id.clone(), None, "test.span".to_string(), attributes);

        // Wait for span creation
        writer.request_flush();
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Add an event
        let payload = serde_json::json!({"key": "value"});
        writer.add_event(
            span_id.clone(),
            "test.event".to_string(),
            Some(payload.clone()),
        );

        // Wait for write
        writer.request_flush();
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Verify event was written
        let result = db
            .query(
                "SELECT span_id, event_type, payload FROM span_events WHERE span_id = ?",
                vec![serde_json::Value::String(span_id)],
            )
            .await;
        assert!(result.is_ok());
        let rows = result.unwrap().rows;
        assert_eq!(rows.len(), 1);
        assert_eq!(
            rows[0]["event_type"],
            serde_json::Value::String("test.event".to_string())
        );
    }

    #[tokio::test]
    async fn test_batching() {
        let (writer, db, _temp_dir) = create_test_writer().await;

        // Create many traces quickly to test batching
        let mut trace_ids = Vec::new();
        for _ in 0..50 {
            let trace_id = writer.start_trace();
            trace_ids.push(trace_id);
        }

        // Wait for batch timeout to trigger
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Verify all traces were written
        let result = db
            .query("SELECT COUNT(*) as count FROM traces", vec![])
            .await;
        assert!(result.is_ok());
        let count = result.unwrap().rows[0]["count"].as_i64().unwrap();
        assert_eq!(count, 50);
    }

    #[tokio::test]
    async fn test_clone_writer() {
        let (writer, _db, _temp_dir) = create_test_writer().await;

        let trace_id1 = writer.start_trace();

        // Clone the writer
        let writer2 = writer.clone();
        let trace_id2 = writer2.start_trace();

        // Both should work independently
        assert!(!trace_id1.is_empty());
        assert!(!trace_id2.is_empty());
        assert_ne!(trace_id1, trace_id2);
    }
}
