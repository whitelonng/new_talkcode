use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
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

fn create_browser_window(
    app: &AppHandle,
    label: &str,
    url: &str,
) -> Result<WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window(label) {
        return Ok(existing);
    }

    let parsed_url = url::Url::from_str(url).map_err(|e| e.to_string())?;
    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TalkCody Browser Control</title>
    <style>
      :root {{
        color-scheme: dark;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #020617;
        color: #e2e8f0;
      }}
      body {{
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 35%),
          linear-gradient(180deg, #0f172a 0%, #020617 100%);
      }}
      main {{
        width: min(640px, calc(100vw - 48px));
        padding: 24px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 18px;
        background: rgba(15, 23, 42, 0.92);
        box-shadow: 0 24px 80px rgba(2, 6, 23, 0.45);
      }}
      h1 {{
        margin: 0 0 8px;
        font-size: 18px;
        font-weight: 700;
      }}
      p {{
        margin: 0 0 12px;
        line-height: 1.6;
        color: #cbd5e1;
      }}
      code, a {{
        color: #93c5fd;
        word-break: break-all;
      }}
      .actions {{
        display: flex;
        gap: 12px;
        margin-top: 20px;
        flex-wrap: wrap;
      }}
      .btn {{
        appearance: none;
        border: 1px solid rgba(96, 165, 250, 0.35);
        background: rgba(37, 99, 235, 0.18);
        color: #dbeafe;
        border-radius: 999px;
        padding: 10px 14px;
        font-size: 13px;
        cursor: pointer;
      }}
      .btn.secondary {{
        border-color: rgba(148, 163, 184, 0.28);
        background: rgba(15, 23, 42, 0.5);
        color: #cbd5e1;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>Windows native browser mode fallback</h1>
      <p>Embedded external loading in WebView2 is still unreliable for some sites.</p>
      <p>Use the button below to open the requested page in your system browser.</p>
      <p><a id="target-link" href="__TARGET_URL__">__TARGET_URL__</a></p>
      <div class="actions">
        <button class="btn" id="open-external" type="button">Open in system browser</button>
        <button class="btn secondary" id="retry-load" type="button">Copy target URL</button>
      </div>
    </main>
    <script>
      const targetUrl = __TARGET_URL_JSON__;
      const openExternal = document.getElementById('open-external');
      const retryLoad = document.getElementById('retry-load');
      if (openExternal) {{
        openExternal.addEventListener('click', () => {{
          window.__TAURI_INTERNALS__.invoke('plugin:shell|open', {{
            path: targetUrl,
          }}).catch(() => {{
            window.location.href = targetUrl;
          }});
        }});
      }}
      if (retryLoad) {{
        retryLoad.addEventListener('click', async () => {{
          try {{
            await navigator.clipboard.writeText(targetUrl);
            retryLoad.textContent = 'Copied target URL';
          }} catch (_) {{
            retryLoad.textContent = targetUrl;
          }}
        }});
      }}
    </script>
  </body>
</html>"#,
    )
    .replace("__TARGET_URL__", parsed_url.as_str())
    .replace(
        "__TARGET_URL_JSON__",
        &serde_json::to_string(parsed_url.as_str()).unwrap_or_else(|_| "\"\"".into()),
    );
    let data_url = format!("data:text/html;base64,{}", BASE64_STANDARD.encode(html));
    let data_url = url::Url::from_str(&data_url).map_err(|e| e.to_string())?;

    WebviewWindowBuilder::new(app, label, WebviewUrl::External(data_url))
        .title("TalkCody Browser Control")
        .visible(true)
        .focused(true)
        .build()
        .map_err(|e| format!("Failed to build native browser window: {e}"))
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

        match create_browser_window(app, &record.window_label, &request.url) {
            Ok(window) => {
                let _ = window.show();
                let _ = window.set_focus();
                record.status = BrowserControlStatus::Ready;
                record.last_navigated_at = Some(now_ms());
                record.title = Some("TalkCody Browser Control".into());
                record.error_code = Some(BrowserControlErrorCode::NativeNotImplemented);
                record.error = Some(
                    "Native browser fallback window opened. Click the button to open the target page in your system browser because embedded external loading is still unreliable."
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

        let navigate_result = app
            .get_webview_window(&record.window_label)
            .ok_or_else(|| "Native browser window not found for session.".to_string())
            .and_then(|window| {
                let opener = app.opener();
                opener
                    .open_url(request.url.clone(), None::<String>)
                    .map_err(|e| format!("Failed to open system browser: {e}"))?;
                let _ = window.set_focus();
                Ok(window)
            });

        match navigate_result {
            Ok(window) => {
                record.status = BrowserControlStatus::Ready;
                record.title = Some("TalkCody Browser Control".into());
                record.error_code = Some(BrowserControlErrorCode::NativeNotImplemented);
                record.error = Some(
                    "Target page was opened in the system browser. Embedded native navigation is still using a fallback route."
                        .into(),
                );
                let _ = window.set_focus();
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
        let maybe_record = sessions.remove(&request.session_id);
        drop(sessions);

        let Some(mut record) = maybe_record else {
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

        record.status = BrowserControlStatus::Closed;
        record.updated_at = now_ms();
        record.closed_at = Some(record.updated_at);
        record.error = None;
        record.error_code = None;

        if let Some(window) = app.get_webview_window(&record.window_label) {
            let _ = window.close();
        }

        let state = record.to_state_response();
        Self::emit_state(app, &state);
        record.to_close_response(true)
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
