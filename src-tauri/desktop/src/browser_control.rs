use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tauri_plugin_opener::OpenerExt;

const NATIVE_BROWSER_EVENT: &str = "browser-native-state-changed";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BrowserControlMode {
    None,
    FileControlled,
    LocalhostControlled,
    ExternalEmbedded,
    ExternalNativeControlled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum BrowserControlStatus {
    Idle,
    Loading,
    Ready,
    Error,
    Navigating,
    Initializing,
    OpeningWindow,
    Failed,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BrowserControlPlatform {
    Web,
    WindowsWebview2,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BrowserControlCapabilityState {
    Available,
    Unavailable,
    Partial,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BrowserControlErrorCode {
    BrowserNotOpen,
    BridgeNotReady,
    CommandAlreadyPending,
    CapabilityUnavailable,
    ScriptExecutionUnavailable,
    IframeNotReady,
    CommandTimedOut,
    SessionReset,
    CommandFailed,
    NativeNotSupported,
    NativeNotImplemented,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserControlCapabilitySet {
    pub navigation: BrowserControlCapabilityState,
    pub dom_read: BrowserControlCapabilityState,
    pub dom_write: BrowserControlCapabilityState,
    pub script_eval: BrowserControlCapabilityState,
    pub console_read: BrowserControlCapabilityState,
    pub network_observe: BrowserControlCapabilityState,
    pub screenshot: BrowserControlCapabilityState,
    pub keyboard_input: BrowserControlCapabilityState,
    pub mouse_input: BrowserControlCapabilityState,
    pub external_control: BrowserControlCapabilityState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserNativeSessionRequest {
    pub session_id: String,
    pub url: String,
    pub mode: BrowserControlMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserNativeNavigateRequest {
    pub session_id: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserNativeSessionResponse {
    pub session_id: String,
    pub status: BrowserControlStatus,
    pub mode: BrowserControlMode,
    pub platform: BrowserControlPlatform,
    pub capabilities: BrowserControlCapabilitySet,
    pub error_code: Option<BrowserControlErrorCode>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserNativeStateResponse {
    pub session_id: String,
    pub status: BrowserControlStatus,
    pub url: Option<String>,
    pub requested_url: Option<String>,
    pub title: Option<String>,
    pub mode: BrowserControlMode,
    pub platform: BrowserControlPlatform,
    pub capabilities: BrowserControlCapabilitySet,
    pub error_code: Option<BrowserControlErrorCode>,
    pub error: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub last_navigated_at: Option<u64>,
    pub closed_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserNativeCloseSessionRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserNativeCloseSessionResponse {
    pub session_id: String,
    pub closed: bool,
    pub status: BrowserControlStatus,
    pub mode: BrowserControlMode,
    pub platform: BrowserControlPlatform,
    pub capabilities: BrowserControlCapabilitySet,
    pub error_code: Option<BrowserControlErrorCode>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
struct BrowserNativeSessionRecord {
    session_id: String,
    window_label: String,
    status: BrowserControlStatus,
    url: Option<String>,
    requested_url: Option<String>,
    title: Option<String>,
    mode: BrowserControlMode,
    platform: BrowserControlPlatform,
    capabilities: BrowserControlCapabilitySet,
    error_code: Option<BrowserControlErrorCode>,
    error: Option<String>,
    created_at: u64,
    updated_at: u64,
    last_navigated_at: Option<u64>,
    closed_at: Option<u64>,
}

#[derive(Default)]
pub struct BrowserNativeSessionManager {
    sessions: Mutex<HashMap<String, BrowserNativeSessionRecord>>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn windows_native_capabilities() -> BrowserControlCapabilitySet {
    BrowserControlCapabilitySet {
        navigation: BrowserControlCapabilityState::Available,
        dom_read: BrowserControlCapabilityState::Partial,
        dom_write: BrowserControlCapabilityState::Partial,
        script_eval: BrowserControlCapabilityState::Partial,
        console_read: BrowserControlCapabilityState::Partial,
        network_observe: BrowserControlCapabilityState::Partial,
        screenshot: BrowserControlCapabilityState::Available,
        keyboard_input: BrowserControlCapabilityState::Available,
        mouse_input: BrowserControlCapabilityState::Available,
        external_control: BrowserControlCapabilityState::Available,
    }
}

fn default_platform() -> BrowserControlPlatform {
    BrowserControlPlatform::WindowsWebview2
}

fn native_supported() -> bool {
    cfg!(target_os = "windows")
}

fn build_window_label(session_id: &str) -> String {
    format!("browser-native-{}", session_id.replace([':', '/', '\\', '.'], "-"))
}

fn open_in_system_browser(app: &AppHandle, url: &str) -> Result<(), String> {
    let opener = app.opener();
    opener
        .open_url(url.to_string(), None::<String>)
        .map_err(|e| format!("Failed to open system browser: {e}"))
}

impl BrowserNativeSessionRecord {
    fn new(session_id: String, url: String) -> Self {
        let timestamp = now_ms();
        Self {
            window_label: build_window_label(&session_id),
            session_id,
            status: BrowserControlStatus::Initializing,
            requested_url: Some(url.clone()),
            url: Some(url),
            title: None,
            mode: BrowserControlMode::ExternalNativeControlled,
            platform: default_platform(),
            capabilities: windows_native_capabilities(),
            error_code: Some(BrowserControlErrorCode::NativeNotImplemented),
            error: Some("Windows native browser session created; WebView2 binding pending.".into()),
            created_at: timestamp,
            updated_at: timestamp,
            last_navigated_at: None,
            closed_at: None,
        }
    }

    fn mark_closed(&mut self) {
        self.status = BrowserControlStatus::Closed;
        self.updated_at = now_ms();
        self.closed_at = Some(self.updated_at);
        self.error = None;
        self.error_code = None;
    }

    fn mark_close_failed(&mut self, error: String) {
        self.status = BrowserControlStatus::Failed;
        self.updated_at = now_ms();
        self.error = Some(error);
        self.error_code = Some(BrowserControlErrorCode::CommandFailed);
    }

    fn to_session_response(&self) -> BrowserNativeSessionResponse {
        BrowserNativeSessionResponse {
            session_id: self.session_id.clone(),
            status: self.status.clone(),
            mode: self.mode.clone(),
            platform: self.platform.clone(),
            capabilities: self.capabilities.clone(),
            error_code: self.error_code.clone(),
            error: self.error.clone(),
        }
    }

    fn to_state_response(&self) -> BrowserNativeStateResponse {
        BrowserNativeStateResponse {
            session_id: self.session_id.clone(),
            status: self.status.clone(),
            url: self.url.clone(),
            requested_url: self.requested_url.clone(),
            title: self.title.clone(),
            mode: self.mode.clone(),
            platform: self.platform.clone(),
            capabilities: self.capabilities.clone(),
            error_code: self.error_code.clone(),
            error: self.error.clone(),
            created_at: self.created_at,
            updated_at: self.updated_at,
            last_navigated_at: self.last_navigated_at,
            closed_at: self.closed_at,
        }
    }

    fn to_close_response(&self, closed: bool) -> BrowserNativeCloseSessionResponse {
        BrowserNativeCloseSessionResponse {
            session_id: self.session_id.clone(),
            closed,
            status: self.status.clone(),
            mode: self.mode.clone(),
            platform: self.platform.clone(),
            capabilities: self.capabilities.clone(),
            error_code: self.error_code.clone(),
            error: self.error.clone(),
        }
    }
}

impl BrowserNativeSessionManager {
    pub fn new() -> Self {
        Self::default()
    }

    fn unsupported_session_response(session_id: String) -> BrowserNativeSessionResponse {
        BrowserNativeSessionResponse {
            session_id,
            status: BrowserControlStatus::Error,
            mode: BrowserControlMode::ExternalNativeControlled,
            platform: default_platform(),
            capabilities: windows_native_capabilities(),
            error_code: Some(BrowserControlErrorCode::NativeNotSupported),
            error: Some("Windows native browser control is only planned for Windows builds.".into()),
        }
    }

    fn unsupported_state_response(session_id: String) -> BrowserNativeStateResponse {
        let timestamp = now_ms();
        BrowserNativeStateResponse {
            session_id,
            status: BrowserControlStatus::Failed,
            url: None,
            requested_url: None,
            title: None,
            mode: BrowserControlMode::ExternalNativeControlled,
            platform: default_platform(),
            capabilities: windows_native_capabilities(),
            error_code: Some(BrowserControlErrorCode::NativeNotSupported),
            error: Some("Windows native browser control is only planned for Windows builds.".into()),
            created_at: timestamp,
            updated_at: timestamp,
            last_navigated_at: None,
            closed_at: None,
        }
    }

    fn unsupported_close_response(session_id: String) -> BrowserNativeCloseSessionResponse {
        BrowserNativeCloseSessionResponse {
            session_id,
            closed: false,
            status: BrowserControlStatus::Failed,
            mode: BrowserControlMode::ExternalNativeControlled,
            platform: default_platform(),
            capabilities: windows_native_capabilities(),
            error_code: Some(BrowserControlErrorCode::NativeNotSupported),
            error: Some("Windows native browser control is only planned for Windows builds.".into()),
        }
    }

    fn emit_state(app: &AppHandle, state: &BrowserNativeStateResponse) {
        let _ = app.emit(NATIVE_BROWSER_EVENT, state.clone());
    }

    fn close_native_window(window: WebviewWindow) -> Result<(), String> {
        window
            .destroy()
            .map_err(|error| format!("failed to destroy browser control window: {error}"))
    }

    pub fn start_session(
        &self,
        app: &AppHandle,
        request: BrowserNativeSessionRequest,
    ) -> BrowserNativeSessionResponse {
        if !native_supported() {
            return Self::unsupported_session_response(request.session_id);
        }

        let mut record = BrowserNativeSessionRecord::new(request.session_id.clone(), request.url.clone());
        record.status = BrowserControlStatus::OpeningWindow;
        record.updated_at = now_ms();

        match open_in_system_browser(app, &request.url) {
            Ok(()) => {
                record.status = BrowserControlStatus::Ready;
                record.last_navigated_at = Some(now_ms());
                record.title = Some("System browser".into());
                record.error_code = Some(BrowserControlErrorCode::NativeNotImplemented);
                record.error = Some(
                    "Target page was opened directly in your system browser. The temporary TalkCody Browser Control child window is disabled on Windows because WebView2 fallback windows were rendering blank and could not be closed reliably."
                        .into(),
                );
            }
            Err(error) => {
                record.status = BrowserControlStatus::Failed;
                record.error_code = Some(BrowserControlErrorCode::CommandFailed);
                record.error = Some(error);
            }
        }

        record.updated_at = now_ms();
        let response = record.to_session_response();
        let state = record.to_state_response();

        let mut sessions = self.sessions.lock().expect("browser native session lock poisoned");
        sessions.insert(request.session_id, record);
        drop(sessions);
        Self::emit_state(app, &state);
        response
    }

    pub fn navigate(
        &self,
        app: &AppHandle,
        request: BrowserNativeNavigateRequest,
    ) -> BrowserNativeStateResponse {
        if !native_supported() {
            return Self::unsupported_state_response(request.session_id);
        }

        let mut sessions = self.sessions.lock().expect("browser native session lock poisoned");
        let timestamp = now_ms();
        let record = sessions.entry(request.session_id.clone()).or_insert_with(|| {
            BrowserNativeSessionRecord::new(request.session_id.clone(), request.url.clone())
        });

        record.status = BrowserControlStatus::Navigating;
        record.requested_url = Some(request.url.clone());
        record.url = Some(request.url.clone());
        record.updated_at = timestamp;
        record.last_navigated_at = Some(timestamp);
        record.closed_at = None;

        let navigate_result = open_in_system_browser(app, &request.url);

        match navigate_result {
            Ok(()) => {
                record.status = BrowserControlStatus::Ready;
                record.title = Some("System browser".into());
                record.error_code = Some(BrowserControlErrorCode::NativeNotImplemented);
                record.error = Some(
                    "Target page was opened in the system browser. The temporary TalkCody Browser Control child window is disabled on Windows because WebView2 fallback windows were rendering blank and could not be closed reliably."
                        .into(),
                );
            }
            Err(error) => {
                record.status = BrowserControlStatus::Failed;
                record.error_code = Some(BrowserControlErrorCode::CommandFailed);
                record.error = Some(error);
            }
        }

        record.updated_at = now_ms();
        let state = record.to_state_response();
        drop(sessions);
        Self::emit_state(app, &state);
        state
    }

    pub fn get_state(&self, session_id: &str) -> BrowserNativeStateResponse {
        if !native_supported() {
            return Self::unsupported_state_response(session_id.to_string());
        }

        let sessions = self.sessions.lock().expect("browser native session lock poisoned");
        if let Some(record) = sessions.get(session_id) {
            return record.to_state_response();
        }

        let timestamp = now_ms();
        BrowserNativeStateResponse {
            session_id: session_id.to_string(),
            status: BrowserControlStatus::Failed,
            url: None,
            requested_url: None,
            title: None,
            mode: BrowserControlMode::ExternalNativeControlled,
            platform: default_platform(),
            capabilities: windows_native_capabilities(),
            error_code: Some(BrowserControlErrorCode::CommandFailed),
            error: Some("Native browser session not found.".into()),
            created_at: timestamp,
            updated_at: timestamp,
            last_navigated_at: None,
            closed_at: None,
        }
    }

    pub fn close_session(
        &self,
        app: &AppHandle,
        request: BrowserNativeCloseSessionRequest,
    ) -> BrowserNativeCloseSessionResponse {
        if !native_supported() {
            return Self::unsupported_close_response(request.session_id);
        }

        let mut sessions = self.sessions.lock().expect("browser native session lock poisoned");
        let Some(mut record) = sessions.remove(&request.session_id) else {
            return BrowserNativeCloseSessionResponse {
                session_id: request.session_id,
                closed: true,
                status: BrowserControlStatus::Closed,
                mode: BrowserControlMode::ExternalNativeControlled,
                platform: default_platform(),
                capabilities: windows_native_capabilities(),
                error_code: None,
                error: None,
            };
        };

        let close_result = app
            .get_webview_window(&record.window_label)
            .map(Self::close_native_window)
            .transpose();

        match close_result {
            Ok(_) => {
                record.mark_closed();
                let state = record.to_state_response();
                drop(sessions);
                Self::emit_state(app, &state);
                record.to_close_response(true)
            }
            Err(error) => {
                record.mark_close_failed(error);
                let state = record.to_state_response();
                let response = record.to_close_response(false);
                sessions.insert(record.session_id.clone(), record);
                drop(sessions);
                Self::emit_state(app, &state);
                response
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mark_closed_sets_closed_state_and_clears_error() {
        let mut record = BrowserNativeSessionRecord::new("session-1".into(), "https://example.com".into());
        record.error = Some("boom".into());
        record.error_code = Some(BrowserControlErrorCode::CommandFailed);

        record.mark_closed();

        assert_eq!(record.status, BrowserControlStatus::Closed);
        assert!(record.closed_at.is_some());
        assert!(record.error.is_none());
        assert!(record.error_code.is_none());
    }

    #[test]
    fn mark_close_failed_sets_failed_state_and_error() {
        let mut record = BrowserNativeSessionRecord::new("session-2".into(), "https://example.com".into());

        record.mark_close_failed("close failed".into());

        assert_eq!(record.status, BrowserControlStatus::Failed);
        assert_eq!(record.error.as_deref(), Some("close failed"));
        assert_eq!(
            record.error_code,
            Some(BrowserControlErrorCode::CommandFailed)
        );
    }
}

#[tauri::command]
pub fn browser_native_session_start(
    app: AppHandle,
    request: BrowserNativeSessionRequest,
    manager: State<Arc<BrowserNativeSessionManager>>,
) -> Result<BrowserNativeSessionResponse, String> {
    Ok(manager.start_session(&app, request))
}

#[tauri::command]
pub fn browser_native_navigate(
    app: AppHandle,
    request: BrowserNativeNavigateRequest,
    manager: State<Arc<BrowserNativeSessionManager>>,
) -> Result<BrowserNativeStateResponse, String> {
    Ok(manager.navigate(&app, request))
}

#[tauri::command]
pub fn browser_native_get_state(
    session_id: String,
    manager: State<Arc<BrowserNativeSessionManager>>,
) -> Result<BrowserNativeStateResponse, String> {
    Ok(manager.get_state(&session_id))
}

#[tauri::command]
pub fn browser_native_close_session(
    app: AppHandle,
    request: BrowserNativeCloseSessionRequest,
    manager: State<Arc<BrowserNativeSessionManager>>,
) -> Result<BrowserNativeCloseSessionResponse, String> {
    Ok(manager.close_session(&app, request))
}
