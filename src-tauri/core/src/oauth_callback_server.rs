// OAuth callback HTTP server for automatic token capture
// This module implements a temporary HTTP server to receive OAuth callbacks

use serde::Serialize;
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::Emitter;

/// OAuth callback result sent to frontend via Tauri event
#[derive(Clone, Serialize)]
pub struct OAuthCallbackResult {
    pub success: bool,
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

/// Server configuration
const DEFAULT_PORT: u16 = 1455;
const CALLBACK_PATH: &str = "/auth/callback";
const SERVER_TIMEOUT_SECS: u64 = 300; // 5 minutes timeout

// Port range for fallback (from DEFAULT_PORT to DEFAULT_PORT + 20)
const PORT_RANGE_START: u16 = 1455;
const PORT_RANGE_END: u16 = 1475;

/// Check if a port is available
fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

/// Find an available port starting from the default port
/// Returns the first available port in the range [PORT_RANGE_START, PORT_RANGE_END]
fn find_available_port() -> Option<u16> {
    (PORT_RANGE_START..=PORT_RANGE_END).find(|&port| is_port_available(port))
}

/// Generate success HTML page
fn generate_success_html() -> String {
    r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authorization Successful</title>
    <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at 20% 20%, #1c1c1f, #0b0b0f 60%);
            color: #f5f5f5;
            font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            letter-spacing: 0.01em;
        }
        .wrap { width: min(540px, 90vw); padding: 32px; }
        .card {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(12, 12, 16, 0.85);
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(16px);
            text-align: center;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
            font-size: 28px;
            margin-bottom: 20px;
        }
        h1 { margin: 0 0 12px; font-size: 26px; font-weight: 600; color: #f8f8f8; }
        .sub { margin: 0 0 24px; color: #cfcfd4; font-size: 15px; }
        .spinner {
            margin: 0 auto 20px;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: 4px solid rgba(255, 255, 255, 0.15);
            border-top-color: #ffffff;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .hint { margin: 0; color: #b6b6bd; line-height: 1.6; font-size: 14px; }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="card">
            <div class="badge">✓</div>
            <h1>Authorization Successful</h1>
            <p class="sub">Your OpenAI account has been connected to TalkCody.</p>
            <div class="spinner" aria-label="Loading"></div>
            <p class="hint">This window will close automatically. You can return to the app now.</p>
        </div>
    </div>
    <script>
        setTimeout(() => { window.close(); }, 3000);
    </script>
</body>
</html>"#.to_string()
}

/// Generate error HTML page
fn generate_error_html(error: &str) -> String {
    // Simple HTML escape for the error message
    let escaped_error = error
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authorization Failed</title>
    <style>
        :root {{ color-scheme: dark; }}
        * {{ box-sizing: border-box; }}
        body {{
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at 20% 20%, #1c1c1f, #0b0b0f 60%);
            color: #f5f5f5;
            font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            letter-spacing: 0.01em;
        }}
        .wrap {{ width: min(540px, 90vw); padding: 32px; }}
        .card {{
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(12, 12, 16, 0.85);
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(16px);
            text-align: center;
        }}
        .badge {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
            font-size: 28px;
            margin-bottom: 20px;
        }}
        h1 {{ margin: 0 0 12px; font-size: 26px; font-weight: 600; color: #f8f8f8; }}
        .sub {{ margin: 0 0 24px; color: #cfcfd4; font-size: 15px; }}
        .error-detail {{
            margin-top: 16px;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #b6b6bd;
            font-size: 13px;
            font-family: monospace;
        }}
        .hint {{ margin: 20px 0 0; color: #b6b6bd; line-height: 1.6; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="wrap">
        <div class="card">
            <div class="badge">✕</div>
            <h1>Authorization Failed</h1>
            <p class="sub">Something went wrong during authorization.</p>
            <p class="error-detail">{}</p>
            <p class="hint">Please close this window and try again.</p>
        </div>
    </div>
</body>
</html>"#,
        escaped_error
    )
}

/// URL decode a string
fn url_decode(s: &str) -> Option<String> {
    let mut result = String::new();
    let mut chars = s.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if hex.len() == 2 {
                if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                    result.push(byte as char);
                } else {
                    return None;
                }
            } else {
                return None;
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }

    Some(result)
}

/// Parse callback request to extract code and state
fn parse_callback_request(url: &str) -> Option<(Option<String>, Option<String>)> {
    // URL format: /auth/callback?code=xxx&state=yyy
    if !url.starts_with(CALLBACK_PATH) {
        return None;
    }

    let query_start = url.find('?')?;
    let query_string = &url[query_start + 1..];

    let mut code = None;
    let mut state = None;

    for param in query_string.split('&') {
        if let Some((key, value)) = param.split_once('=') {
            match key {
                "code" => code = url_decode(value),
                "state" => state = url_decode(value),
                _ => {}
            }
        }
    }

    Some((code, state))
}

/// Start OAuth callback server
/// Returns the port number the server is listening on
#[tauri::command]
pub async fn start_oauth_callback_server(
    window: tauri::Window,
    expected_state: Option<String>,
) -> Result<u16, String> {
    log::info!("Starting OAuth callback server...");

    // Check if default port is available, otherwise try to find another port
    let port = if is_port_available(DEFAULT_PORT) {
        DEFAULT_PORT
    } else {
        // Try to find an available port in the fallback range
        match find_available_port() {
            Some(available_port) => available_port,
            None => {
                return Err(format!(
                    "All ports from {} to {} are in use. Please close other applications and try again, or use manual code entry instead.",
                    PORT_RANGE_START, PORT_RANGE_END
                ));
            }
        }
    };
    let shutdown_flag = Arc::new(AtomicBool::new(false));
    let shutdown_flag_clone = shutdown_flag.clone();

    // Spawn server in background thread
    thread::spawn(move || {
        let result = run_callback_server(port, expected_state, shutdown_flag_clone);

        // Emit result to frontend
        if let Err(e) = window.emit("openai-oauth-callback", &result) {
            log::error!("Failed to emit OAuth callback event: {:?}", e);
        }

        log::info!("OAuth callback server stopped");
    });

    // Set up timeout auto-shutdown
    let shutdown_flag_timeout = shutdown_flag;
    thread::spawn(move || {
        thread::sleep(Duration::from_secs(SERVER_TIMEOUT_SECS));
        if !shutdown_flag_timeout.load(Ordering::SeqCst) {
            log::info!(
                "OAuth callback server timed out after {} seconds",
                SERVER_TIMEOUT_SECS
            );
            shutdown_flag_timeout.store(true, Ordering::SeqCst);
        }
    });

    log::info!("OAuth callback server started on port {}", port);
    Ok(port)
}

/// Run the callback server (blocking)
fn run_callback_server(
    port: u16,
    expected_state: Option<String>,
    shutdown_flag: Arc<AtomicBool>,
) -> OAuthCallbackResult {
    // Create server using tiny_http
    let server = match tiny_http::Server::http(format!("127.0.0.1:{}", port)) {
        Ok(s) => s,
        Err(e) => {
            log::error!("Failed to start HTTP server: {}", e);
            return OAuthCallbackResult {
                success: false,
                code: None,
                state: None,
                error: Some(format!("Failed to start server: {}", e)),
            };
        }
    };

    log::info!("OAuth callback server listening on 127.0.0.1:{}", port);

    loop {
        // Check shutdown flag
        if shutdown_flag.load(Ordering::SeqCst) {
            return OAuthCallbackResult {
                success: false,
                code: None,
                state: None,
                error: Some("Server timed out".to_string()),
            };
        }

        // Receive request with timeout
        let request = match server.recv_timeout(Duration::from_secs(1)) {
            Ok(Some(req)) => req,
            Ok(None) => continue, // Timeout, check shutdown flag
            Err(e) => {
                log::error!("Error receiving request: {}", e);
                continue;
            }
        };

        let url = request.url().to_string();
        log::info!("Received request: {} {}", request.method(), url);

        // Only handle callback path
        if !url.starts_with(CALLBACK_PATH) {
            // Return 404 for other requests
            let response = tiny_http::Response::from_string("Not Found").with_status_code(404);
            let _ = request.respond(response);
            continue;
        }

        // Parse code and state
        let (code, state) = match parse_callback_request(&url) {
            Some((code, state)) => (code, state),
            None => {
                let html = generate_error_html("Invalid callback request");
                let response = tiny_http::Response::from_string(html)
                    .with_status_code(400)
                    .with_header(
                        tiny_http::Header::from_bytes(
                            &b"Content-Type"[..],
                            &b"text/html; charset=utf-8"[..],
                        )
                        .unwrap(),
                    );
                let _ = request.respond(response);
                continue;
            }
        };

        // Validate state if provided
        if let Some(ref expected) = expected_state {
            if state.as_ref() != Some(expected) {
                log::error!("State mismatch: expected {:?}, got {:?}", expected, state);
                let html = generate_error_html("State mismatch - security validation failed");
                let response = tiny_http::Response::from_string(html)
                    .with_status_code(400)
                    .with_header(
                        tiny_http::Header::from_bytes(
                            &b"Content-Type"[..],
                            &b"text/html; charset=utf-8"[..],
                        )
                        .unwrap(),
                    );
                let _ = request.respond(response);

                shutdown_flag.store(true, Ordering::SeqCst);
                return OAuthCallbackResult {
                    success: false,
                    code: None,
                    state,
                    error: Some("State mismatch".to_string()),
                };
            }
        }

        // Check if we have a code
        if code.is_none() {
            let html = generate_error_html("No authorization code received");
            let response = tiny_http::Response::from_string(html)
                .with_status_code(400)
                .with_header(
                    tiny_http::Header::from_bytes(
                        &b"Content-Type"[..],
                        &b"text/html; charset=utf-8"[..],
                    )
                    .unwrap(),
                );
            let _ = request.respond(response);

            shutdown_flag.store(true, Ordering::SeqCst);
            return OAuthCallbackResult {
                success: false,
                code: None,
                state,
                error: Some("No authorization code".to_string()),
            };
        }

        // Success! Send success page
        let html = generate_success_html();
        let response = tiny_http::Response::from_string(html)
            .with_status_code(200)
            .with_header(
                tiny_http::Header::from_bytes(
                    &b"Content-Type"[..],
                    &b"text/html; charset=utf-8"[..],
                )
                .unwrap(),
            );
        let _ = request.respond(response);

        shutdown_flag.store(true, Ordering::SeqCst);
        return OAuthCallbackResult {
            success: true,
            code,
            state,
            error: None,
        };
    }
}
