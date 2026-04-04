#![cfg_attr(target_os = "macos", allow(unexpected_cfgs))]

use crate::database::Database;
use crate::window_manager::create_window;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Manager;

/// Common helper to create window from dock menu actions
/// Uses spawn instead of block_on to avoid potential deadlocks when called from Cocoa main thread
fn create_window_from_dock(
    project_id: Option<String>,
    root_path: Option<String>,
    is_new_window: bool,
) {
    // Use spawn instead of block_on to avoid deadlock risk
    // Cocoa menu callbacks may run on the main thread, and blocking would be dangerous
    tauri::async_runtime::spawn(async move {
        let app_handle = crate::get_app_handle();
        let window_registry = app_handle
            .state::<crate::AppState>()
            .window_registry
            .clone();

        if let Err(e) = create_window(
            app_handle,
            &window_registry,
            project_id,
            root_path,
            is_new_window,
        ) {
            log::error!("Failed to create window from dock menu: {}", e);
        }
    });
}

/// Query recent projects from database
/// Uses the recent_projects table which tracks actual project open times
async fn query_recent_projects(db: &Arc<Database>) -> Vec<serde_json::Value> {
    // Query from recent_projects table which tracks when projects were actually opened
    // This gives accurate "recent" ordering based on last open time, not update time
    let sql = "SELECT project_id as id, project_name as name, root_path FROM recent_projects ORDER BY opened_at DESC LIMIT 10";
    match db.query(sql, vec![]).await {
        Ok(result) => result.rows,
        Err(e) => {
            log::error!("Failed to query recent projects for dock menu: {}", e);
            vec![]
        }
    }
}

/// Refresh the dock menu with the latest recent projects
/// This function queries the database and updates the dock menu on the main thread
#[cfg(target_os = "macos")]
pub async fn refresh_dock_menu() {
    let app_handle = crate::get_app_handle().clone();

    // Try to get database with retry
    let db = {
        let mut retry_count = 0;
        let max_retries = 5;
        let mut backoff_ms: u64 = 50;

        loop {
            if let Some(state) = app_handle.try_state::<Arc<Database>>() {
                let db = state.inner().clone();
                if db.connect().await.is_ok() {
                    break db;
                }
            }

            retry_count += 1;
            if retry_count >= max_retries {
                log::error!(
                    "Failed to get database for dock menu refresh after {} retries",
                    max_retries
                );
                return;
            }

            let sleep_ms = backoff_ms;
            backoff_ms = (backoff_ms * 2).min(500);
            tokio::time::sleep(tokio::time::Duration::from_millis(sleep_ms)).await;
        }
    };

    let recent_projects = query_recent_projects(&db).await;

    log::info!(
        "Refreshing dock menu with {} recent projects",
        recent_projects.len()
    );

    if let Err(e) = app_handle.run_on_main_thread(move || {
        create_native_dock_menu(&recent_projects);
    }) {
        log::error!("Failed to refresh dock menu on main thread: {}", e);
    }
}

/// Setup dock menu on macOS using native Cocoa API
#[cfg(target_os = "macos")]
pub fn setup_dock_menu() {
    let app_handle = crate::get_app_handle().clone();

    // Spawn async task to load data, then update UI on main thread
    tauri::async_runtime::spawn(async move {
        // Use retry loop instead of fixed delay to handle database initialization
        // This is more reliable than hardcoded sleep
        let mut retry_count = 0;
        let max_retries = 20; // max wait ~4 seconds with backoff
        let mut backoff_ms: u64 = 50;
        let max_backoff_ms: u64 = 500;

        let db = loop {
            if let Some(state) = app_handle.try_state::<Arc<Database>>() {
                let db = state.inner().clone();
                // Try to connect to database
                if db.connect().await.is_ok() {
                    log::info!(
                        "Database connected for dock menu after {} attempts",
                        retry_count + 1
                    );
                    break db;
                }
            }

            retry_count += 1;
            if retry_count >= max_retries {
                log::error!(
                    "Failed to get database for dock menu after {} retries",
                    max_retries
                );
                return;
            }

            let sleep_ms = backoff_ms;
            backoff_ms = (backoff_ms * 2).min(max_backoff_ms);
            tokio::time::sleep(tokio::time::Duration::from_millis(sleep_ms)).await;
        };

        let recent_projects = query_recent_projects(&db).await;

        log::info!(
            "Found {} recent projects for dock menu",
            recent_projects.len()
        );

        let app_handle = app_handle.clone();
        if let Err(e) = app_handle.run_on_main_thread(move || {
            create_native_dock_menu(&recent_projects);
        }) {
            log::error!("Failed to update dock menu on main thread: {}", e);
        }
    });
}

#[derive(Debug, Serialize, Deserialize)]
struct DockMenuPayload {
    id: Option<String>,
    path: String,
}

#[derive(Debug)]
struct DockMenuEntry {
    title: String,
    payload: String,
}

fn decode_dock_menu_payload(payload: &str) -> (Option<String>, String) {
    match serde_json::from_str::<DockMenuPayload>(payload) {
        Ok(decoded) => (decoded.id, decoded.path),
        Err(_) => {
            log::warn!(
                "Dock menu payload format warning, treating as path only: {}",
                payload
            );
            (None, payload.to_string())
        }
    }
}

fn build_dock_menu_entries(recent_projects: &[serde_json::Value]) -> Vec<DockMenuEntry> {
    let mut entries = Vec::new();

    for project in recent_projects {
        // Robustly extract ID (handle both String and Number)
        let id = project
            .get("id")
            .map(|v| match v {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                _ => "".to_string(),
            })
            .unwrap_or_default();

        let name = project
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown Project");
        let root_path = project
            .get("root_path")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if !root_path.is_empty() {
            let payload = serde_json::to_string(&DockMenuPayload {
                id: if id.is_empty() { None } else { Some(id) },
                path: root_path.to_string(),
            })
            .unwrap_or_default();

            entries.push(DockMenuEntry {
                title: name.to_string(),
                payload,
            });
        }
    }

    entries
}

#[cfg(target_os = "macos")]
fn create_native_dock_menu(recent_projects: &[serde_json::Value]) {
    use cocoa::appkit::{NSApp, NSMenu, NSMenuItem};
    use cocoa::base::nil;
    use cocoa::foundation::NSString;
    use objc::declare::ClassDecl;
    use objc::runtime::{Class, Object, Sel};
    use objc::{msg_send, sel, sel_impl};
    use std::sync::Once;

    let menu_entries = build_dock_menu_entries(recent_projects);

    // SAFETY: All unsafe operations in this function are necessary for Cocoa/Objective-C interop.
    // The cocoa crate provides safe abstractions over raw Objective-C calls, but they're marked
    // unsafe because they cross FFI boundaries. We ensure safety by:
    // 1. Only calling valid Cocoa API methods with correct signatures
    // 2. Managing object lifetimes properly (ARC handles retain/release)
    // 3. Using Once to ensure class registration happens only once
    // 4. Validating all data before passing to Objective-C (e.g., UTF-8 strings)
    unsafe {
        // SAFETY: NSApp() returns the shared application instance, always valid in a GUI app
        let app = NSApp();
        // SAFETY: NSMenu::new creates a new autoreleased menu object
        let dock_menu: *mut Object = NSMenu::new(nil);

        // Create target class for menu actions
        // SAFETY: Once ensures this registration happens exactly once, preventing duplicate class definitions
        static INIT: Once = Once::new();
        INIT.call_once(|| {
            let class_name = "TalkCodyDockMenuTarget";
            // SAFETY: ClassDecl::new is safe as long as class name is unique (guaranteed by Once)
            let mut decl = ClassDecl::new(class_name, Class::get("NSObject").unwrap()).unwrap();

            // New window action callback
            // SAFETY: This extern "C" function matches Objective-C method signature requirements
            extern "C" fn open_new_window_action(_this: &Object, _cmd: Sel, _sender: *mut Object) {
                log::info!("Dock menu: New window action triggered");
                create_window_from_dock(None, None, true);
            }

            // Project open action callback
            // SAFETY: This extern "C" function matches Objective-C method signature requirements
            extern "C" fn open_project_action(_this: &Object, _cmd: Sel, sender: *mut Object) {
                // SAFETY: Calling Objective-C methods on menu item sender
                unsafe {
                    // SAFETY: representedObject is set by us below, guaranteed to be NSString
                    let payload_obj: *mut Object = msg_send![sender, representedObject];
                    // SAFETY: UTF8String returns a valid C string pointer for NSString objects
                    let payload_cstr: *const i8 = msg_send![payload_obj, UTF8String];
                    // SAFETY: UTF8String returns a null-terminated valid UTF-8 string
                    let payload = std::ffi::CStr::from_ptr(payload_cstr).to_string_lossy();

                    log::info!("Dock menu: Open project action triggered: {}", payload);

                    let (project_id, path) = decode_dock_menu_payload(&payload);

                    create_window_from_dock(project_id, Some(path), false);
                }
            }

            let new_window_selector = Sel::register("openNewWindowAction:");
            decl.add_method(
                new_window_selector,
                open_new_window_action as extern "C" fn(&Object, Sel, *mut Object),
            );

            let project_selector = Sel::register("openProjectAction:");
            decl.add_method(
                project_selector,
                open_project_action as extern "C" fn(&Object, Sel, *mut Object),
            );

            decl.register();
        });

        // Get the target class
        // SAFETY: Class was registered above in Once block, guaranteed to exist
        let target_class = Class::get("TalkCodyDockMenuTarget").unwrap();

        // Add recent projects (with folder icon)
        if !menu_entries.is_empty() {
            for entry in menu_entries {
                // SAFETY: Creating NSString from Rust &str - cocoa validates UTF-8
                let title = NSString::alloc(nil).init_str(&entry.title);
                let selector = Sel::register("openProjectAction:");
                // SAFETY: Creating menu item with valid title, action, and empty key equivalent
                let item: *mut Object = NSMenuItem::alloc(nil).initWithTitle_action_keyEquivalent_(
                    title,
                    selector,
                    NSString::alloc(nil).init_str(""),
                );

                // SAFETY: Creating new instance of our registered class
                let target: *mut Object = msg_send![target_class, new];
                // SAFETY: Setting the target for menu item action
                let _: () = msg_send![item, setTarget: target];

                // SAFETY: Creating NSString from validated UTF-8 payload string
                let payload_string = NSString::alloc(nil).init_str(&entry.payload);
                // SAFETY: Storing NSString as representedObject (type-safe Objective-C property)
                let _: () = msg_send![item, setRepresentedObject: payload_string];

                // Note: Folder icon temporarily disabled due to compatibility issues
                // TODO: Add folder icon when a stable solution is found

                // SAFETY: Adding menu item to menu - standard Cocoa API
                let _: () = msg_send![dock_menu, addItem: item];
            }

            // Add separator after projects
            // SAFETY: Adding system-provided separator menu item
            let _: () = msg_send![dock_menu, addItem: NSMenuItem::separatorItem(nil)];
        }

        // Add "New Window" item (now at the bottom)
        // SAFETY: Creating NSString from static string literal
        let title = NSString::alloc(nil).init_str("New Window");
        let selector = Sel::register("openNewWindowAction:");
        // SAFETY: Creating menu item with valid parameters
        let item: *mut Object = NSMenuItem::alloc(nil).initWithTitle_action_keyEquivalent_(
            title,
            selector,
            NSString::alloc(nil).init_str(""),
        );

        // SAFETY: Creating new instance of our registered target class
        let target: *mut Object = msg_send![target_class, new];
        // SAFETY: Setting target and adding to menu - standard Cocoa operations
        let _: () = msg_send![item, setTarget: target];
        let _: () = msg_send![dock_menu, addItem: item];
        let _: () = msg_send![item, setEnabled: true];

        // Set the dock menu on the application
        // SAFETY: Setting dock menu on NSApp - standard macOS API, menu is retained by app
        let _: () = msg_send![app, setDockMenu: dock_menu];

        log::info!("Dock menu successfully created and set");
    }
}

/// No-op for other platforms
#[cfg(not(target_os = "macos"))]
pub fn setup_dock_menu() {
    // Dock menu is only supported on macOS
}

/// No-op for other platforms
#[cfg(not(target_os = "macos"))]
pub async fn refresh_dock_menu() {
    // Dock menu is only supported on macOS
}

/// Handle dock menu events (placeholder for future implementation)
pub fn handle_dock_menu_event<R: tauri::Runtime>(
    _app: &tauri::AppHandle<R>,
    _event: tauri::menu::MenuEvent,
) {
    // Dock menu events are handled by native Cocoa code above
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_dock_menu_payload_json() {
        let payload = DockMenuPayload {
            id: Some("project-1".to_string()),
            path: "/tmp/project".to_string(),
        };
        let encoded = serde_json::to_string(&payload).expect("encode payload");
        let (id, path) = decode_dock_menu_payload(&encoded);
        assert_eq!(id, Some("project-1".to_string()));
        assert_eq!(path, "/tmp/project");
    }

    #[test]
    fn test_decode_dock_menu_payload_fallback() {
        let raw = "/tmp/with|pipe".to_string();
        let (id, path) = decode_dock_menu_payload(&raw);
        assert_eq!(id, None);
        assert_eq!(path, raw);
    }

    #[test]
    fn test_build_dock_menu_entries() {
        let projects = vec![
            serde_json::json!({
                "id": "1",
                "name": "First",
                "root_path": "/tmp/first"
            }),
            serde_json::json!({
                "id": 2,
                "name": "Second",
                "root_path": "/tmp/second"
            }),
            serde_json::json!({
                "id": 3,
                "name": "NoPath"
            }),
        ];

        let entries = build_dock_menu_entries(&projects);
        assert_eq!(entries.len(), 2);

        let payloads: Vec<DockMenuPayload> = entries
            .iter()
            .map(|entry| serde_json::from_str(&entry.payload).expect("decode payload"))
            .collect();

        let has_first = payloads
            .iter()
            .any(|payload| payload.id.as_deref() == Some("1") && payload.path == "/tmp/first");
        let has_second = payloads
            .iter()
            .any(|payload| payload.id.as_deref() == Some("2") && payload.path == "/tmp/second");

        assert!(has_first);
        assert!(has_second);
    }
}
