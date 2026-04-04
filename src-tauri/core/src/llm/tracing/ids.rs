// ID generation for traces and spans
// Follows OpenTelemetry conventions where applicable

use chrono::Utc;
use rand::Rng;
use uuid::Uuid;

/// Generates a unique trace ID
/// Format: "YYYYMMDDhhmmssfff-uuid" (17 digit timestamp + 8 char uuid suffix)
/// Example: "20260130123456789-abc12345"
pub fn generate_trace_id() -> String {
    let now = Utc::now();
    let timestamp = now.format("%Y%m%d%H%M%S%3f").to_string();
    let uuid_suffix = Uuid::new_v4().to_string()[..8].to_string();
    format!("{}-{}", timestamp, uuid_suffix)
}

/// Generates a unique span ID
/// Format: 16 hex characters
/// Example: "a1b2c3d4e5f67890"
pub fn generate_span_id() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..8).map(|_| rng.gen()).collect();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Generates a unique event ID
/// Uses a UUID v4 shortened to 16 characters for consistency with span IDs
pub fn generate_event_id() -> String {
    Uuid::new_v4().to_string().replace('-', "")[..16].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_trace_id_format() {
        let trace_id = generate_trace_id();

        // Should be in format: YYYYMMDDhhmmssfff-uuid (17 + 1 + 8 = 26 chars)
        assert_eq!(trace_id.len(), 26, "Trace ID should be 26 characters");

        // Should contain exactly one hyphen
        let parts: Vec<&str> = trace_id.split('-').collect();
        assert_eq!(parts.len(), 2, "Trace ID should have exactly one hyphen");

        // Timestamp part should be 17 digits
        assert_eq!(parts[0].len(), 17, "Timestamp part should be 17 characters");
        assert!(
            parts[0].chars().all(|c| c.is_ascii_digit()),
            "Timestamp part should be all digits"
        );

        // UUID suffix should be 8 hex characters
        assert_eq!(parts[1].len(), 8, "UUID suffix should be 8 characters");
    }

    #[test]
    fn test_generate_trace_id_uniqueness() {
        // Generate many IDs and check for uniqueness
        let mut ids = std::collections::HashSet::new();
        for _ in 0..1000 {
            let id = generate_trace_id();
            assert!(
                ids.insert(id.clone()),
                "Generated duplicate trace ID: {}",
                id
            );
        }
        assert_eq!(ids.len(), 1000, "Should have 1000 unique IDs");
    }

    #[test]
    fn test_generate_span_id_format() {
        let span_id = generate_span_id();

        // Should be exactly 16 hex characters
        assert_eq!(span_id.len(), 16, "Span ID should be 16 characters");

        // Should be valid hex
        assert!(
            span_id.chars().all(|c| c.is_ascii_hexdigit()),
            "Span ID should be valid hexadecimal"
        );
    }

    #[test]
    fn test_generate_span_id_uniqueness() {
        // Generate many IDs and check for uniqueness
        let mut ids = std::collections::HashSet::new();
        for _ in 0..1000 {
            let id = generate_span_id();
            assert!(
                ids.insert(id.clone()),
                "Generated duplicate span ID: {}",
                id
            );
        }
        assert_eq!(ids.len(), 1000, "Should have 1000 unique IDs");
    }

    #[test]
    fn test_generate_event_id_format() {
        let event_id = generate_event_id();

        // Should be exactly 16 hex characters
        assert_eq!(event_id.len(), 16, "Event ID should be 16 characters");

        // Should be valid hex
        assert!(
            event_id.chars().all(|c| c.is_ascii_hexdigit()),
            "Event ID should be valid hexadecimal"
        );
    }

    #[test]
    fn test_generate_event_id_uniqueness() {
        let mut ids = std::collections::HashSet::new();
        for _ in 0..1000 {
            let id = generate_event_id();
            assert!(
                ids.insert(id.clone()),
                "Generated duplicate event ID: {}",
                id
            );
        }
        assert_eq!(ids.len(), 1000, "Should have 1000 unique IDs");
    }

    #[test]
    fn test_trace_id_timestamp_ordering() {
        // Generate IDs and verify they are roughly time-ordered
        let id1 = generate_trace_id();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let id2 = generate_trace_id();

        let ts1 = &id1[..17];
        let ts2 = &id2[..17];

        assert!(
            ts1 <= ts2,
            "Second trace ID should have >= timestamp than first"
        );
    }
}
