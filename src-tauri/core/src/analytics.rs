use crate::device_id::get_or_create_device_id;
use reqwest::Client;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::time::Instant;

const API_URL: &str = "https://api.talkcody.com/api/analytics/events";

/// Analytics session information
#[derive(Debug, Clone)]
pub struct AnalyticsSession {
    pub device_id: String,
    pub session_id: String,
    pub start_time: Instant,
}

/// State to store analytics session info
pub struct AnalyticsState {
    pub session: Arc<Mutex<Option<AnalyticsSession>>>,
    pub client: Client,
}

impl Default for AnalyticsState {
    fn default() -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
            client: Client::new(),
        }
    }
}

impl AnalyticsState {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Clone for AnalyticsState {
    fn clone(&self) -> Self {
        Self {
            session: Arc::clone(&self.session),
            client: self.client.clone(),
        }
    }
}

#[derive(Serialize)]
struct AnalyticsPayload {
    #[serde(rename = "eventType")]
    event_type: String,
    #[serde(rename = "sessionId")]
    session_id: String,
    #[serde(rename = "deviceId")]
    device_id: String,
    #[serde(rename = "osName", skip_serializing_if = "Option::is_none")]
    os_name: Option<String>,
    #[serde(rename = "osVersion", skip_serializing_if = "Option::is_none")]
    os_version: Option<String>,
    #[serde(rename = "appVersion", skip_serializing_if = "Option::is_none")]
    app_version: Option<String>,
}

fn get_os_name() -> String {
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return "unknown".to_string();
}

fn get_os_version() -> String {
    std::env::consts::OS.to_string()
}

pub async fn start_session(
    state: &AnalyticsState,
    app_data_dir: &std::path::Path,
    app_version: &str,
) {
    let device_id = get_or_create_device_id(app_data_dir);
    let session_id = uuid::Uuid::new_v4().to_string();

    log::info!(
        "Starting analytics session: device_id={}, session_id={}",
        device_id,
        session_id
    );

    {
        let mut session_guard = match state.session.lock() {
            Ok(g) => g,
            Err(e) => {
                log::error!("Failed to lock analytics session: {}", e);
                return;
            }
        };
        *session_guard = Some(AnalyticsSession {
            device_id: device_id.clone(),
            session_id: session_id.clone(),
            start_time: Instant::now(),
        });
    }

    // Send session_start event
    let payload = AnalyticsPayload {
        event_type: "session_start".to_string(),
        session_id,
        device_id,
        os_name: Some(get_os_name()),
        os_version: Some(get_os_version()),
        app_version: Some(app_version.to_string()),
    };

    match state
        .client
        .post(API_URL)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            log::info!(
                "Session start sent successfully, status: {}",
                response.status()
            );
        }
        Err(e) => {
            log::error!("Failed to send session_start: {}", e);
        }
    }
}

pub fn send_session_end_sync(state: &AnalyticsState) {
    let session = {
        let guard = match state.session.lock() {
            Ok(g) => g,
            Err(e) => {
                log::error!("Failed to lock analytics session: {}", e);
                return;
            }
        };
        guard.clone()
    };

    if let Some(session) = session {
        log::info!(
            "Sending session_end event for session_id={}, duration={:?}",
            session.session_id,
            session.start_time.elapsed()
        );

        let payload = AnalyticsPayload {
            event_type: "session_end".to_string(),
            session_id: session.session_id.clone(),
            device_id: session.device_id.clone(),
            os_name: None,
            os_version: None,
            app_version: None,
        };

        // Use blocking request since we're in a sync context during window close
        let client = reqwest::blocking::Client::new();
        match client
            .post(API_URL)
            .json(&payload)
            .timeout(std::time::Duration::from_secs(5))
            .send()
        {
            Ok(response) => {
                log::info!(
                    "Session end sent successfully, status: {}",
                    response.status()
                );
            }
            Err(e) => {
                log::error!("Failed to send session_end: {}", e);
            }
        }

        // Clear the session after sending
        if let Ok(mut guard) = state.session.lock() {
            *guard = None;
        }
    } else {
        log::info!("No analytics session to end");
    }
}
