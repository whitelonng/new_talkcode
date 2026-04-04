//! Streaming Layer
//!
//! Handles event streaming for SSE with buffering, throttling, and resume capability.

pub mod buffer;
pub mod events;
pub mod throttle;

pub use buffer::{BufferStats, EventBuffer};
pub use events::*;
pub use throttle::{EventThrottler, StreamingManager, ThrottleConfig};

/// Create a new streaming manager with default configuration
pub fn create_manager() -> StreamingManager {
    StreamingManager::new()
}

/// Create a streaming manager with custom buffer capacity
pub fn create_manager_with_capacity(capacity: usize) -> StreamingManager {
    StreamingManager::new().with_buffer_capacity(capacity)
}
