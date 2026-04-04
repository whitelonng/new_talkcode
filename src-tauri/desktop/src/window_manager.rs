use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

use crate::file_watcher::FileWatcher;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub label: String,
    pub project_id: Option<String>,
    pub root_path: Option<String>,
    pub title: String,
}

pub struct WindowState {
    pub project_id: Option<String>,
    pub root_path: Option<String>,
    pub file_watcher: Option<FileWatcher>,
}

#[derive(Clone)]
pub struct WindowRegistry {
    windows: Arc<Mutex<HashMap<String, WindowState>>>,
}

impl Default for WindowRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl WindowRegistry {
    pub fn new() -> Self {
        Self {
            windows: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn register_window(&self, label: String, state: WindowState) -> Result<(), String> {
        let mut windows = self.windows.lock().map_err(|e| e.to_string())?;
        windows.insert(label, state);
        Ok(())
    }

    pub fn unregister_window(&self, label: &str) -> Result<(), String> {
        let mut windows = self.windows.lock().map_err(|e| e.to_string())?;
        if let Some(mut state) = windows.remove(label) {
            // Stop file watcher if exists
            if let Some(mut watcher) = state.file_watcher.take() {
                watcher.stop();
            }
        }
        Ok(())
    }

    pub fn get_all_windows(&self) -> Result<Vec<WindowInfo>, String> {
        let windows = self.windows.lock().map_err(|e| e.to_string())?;
        let mut infos = Vec::new();
        for (label, state) in windows.iter() {
            infos.push(WindowInfo {
                label: label.clone(),
                project_id: state.project_id.clone(),
                root_path: state.root_path.clone(),
                title: build_window_title(state.root_path.as_ref()),
            });
        }
        Ok(infos)
    }

    pub fn find_window_by_project(&self, root_path: &str) -> Result<Option<String>, String> {
        let windows = self.windows.lock().map_err(|e| e.to_string())?;
        for (label, state) in windows.iter() {
            if let Some(ref path) = state.root_path {
                if path == root_path {
                    return Ok(Some(label.clone()));
                }
            }
        }
        Ok(None)
    }

    pub fn update_window_project(
        &self,
        label: &str,
        project_id: Option<String>,
        root_path: Option<String>,
    ) -> Result<(), String> {
        let mut windows = self.windows.lock().map_err(|e| e.to_string())?;
        if let Some(state) = windows.get_mut(label) {
            state.project_id = project_id;
            state.root_path = root_path;
        }
        Ok(())
    }

    pub fn set_window_file_watcher(
        &self,
        label: &str,
        watcher: Option<FileWatcher>,
    ) -> Result<(), String> {
        let mut windows = self.windows.lock().map_err(|e| e.to_string())?;
        if let Some(state) = windows.get_mut(label) {
            // Stop existing watcher if any
            if let Some(mut old_watcher) = state.file_watcher.take() {
                old_watcher.stop();
            }
            state.file_watcher = watcher;
        }
        Ok(())
    }

    /// Stop all file watchers across all windows
    /// This should be called when the application exits to release file handles
    pub fn cleanup_all_watchers(&self) {
        log::info!("Cleaning up all window file watchers");
        if let Ok(mut windows) = self.windows.lock() {
            for (label, state) in windows.iter_mut() {
                if let Some(mut watcher) = state.file_watcher.take() {
                    log::info!("Stopping file watcher for window: {}", label);
                    watcher.stop();
                }
            }
        } else {
            log::error!("Failed to acquire lock for cleanup_all_watchers");
        }
    }
}

/// Try to focus an existing window if the project is already open
fn try_focus_existing_window<R: Runtime>(
    app_handle: &AppHandle<R>,
    window_registry: &WindowRegistry,
    root_path: &str,
) -> Result<Option<String>, String> {
    if let Some(existing_label) = window_registry.find_window_by_project(root_path)? {
        log::info!(
            "Project already open in window: {}, attempting to focus it",
            existing_label
        );
        if let Some(window) = app_handle.get_webview_window(&existing_label) {
            window.set_focus().map_err(|e| e.to_string())?;
            window.show().map_err(|e| e.to_string())?;
            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::NSApplication;
                unsafe {
                    let app = cocoa::appkit::NSApp();
                    app.activateIgnoringOtherApps_(cocoa::base::YES);
                }
            }
            log::info!("Successfully focused existing window: {}", existing_label);
            return Ok(Some(existing_label));
        } else {
            log::warn!(
                "Window {} is in registry but doesn't exist, cleaning up",
                existing_label
            );
            window_registry.unregister_window(&existing_label)?;
            log::info!("Cleaned up stale window registration, will create new window");
        }
    }
    Ok(None)
}

/// Generate a unique window label
fn generate_window_label() -> Result<String, String> {
    let label = format!(
        "window-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis()
    );
    Ok(label)
}

/// Build window title based on root path
fn build_window_title(root_path: Option<&String>) -> String {
    root_path
        .and_then(|p| std::path::Path::new(p).file_name())
        .and_then(|n| n.to_str())
        .map(|s| format!("{} - TalkCody", s))
        .unwrap_or_else(|| "TalkCody".to_string())
}

/// Register window in registry and set up cleanup handler
/// Remove a window's state from windows-state.json
/// This prevents accumulation of closed window states
fn remove_window_state_from_file<R: Runtime>(
    app_handle: &AppHandle<R>,
    window_label: &str,
) -> Result<(), String> {
    // Skip main window - we don't want to remove it
    if window_label == "main" {
        return Ok(());
    }

    // Get app data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let state_file = app_data_dir.join("windows-state.json");

    // If file doesn't exist, nothing to clean up
    if !state_file.exists() {
        return Ok(());
    }

    // Read current state
    let content = fs::read_to_string(&state_file)
        .map_err(|e| format!("Failed to read windows-state.json: {}", e))?;

    let mut state: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse windows-state.json: {}", e))?;

    // Remove the window with matching label
    if let Some(windows) = state.get_mut("windows").and_then(|w| w.as_array_mut()) {
        let original_len = windows.len();
        windows.retain(|window| {
            window
                .get("label")
                .and_then(|l| l.as_str())
                .map(|l| l != window_label)
                .unwrap_or(true)
        });
        let removed_count = original_len - windows.len();

        if removed_count > 0 {
            // Write back to file
            let updated_content = serde_json::to_string_pretty(&state)
                .map_err(|e| format!("Failed to serialize state: {}", e))?;
            fs::write(&state_file, updated_content)
                .map_err(|e| format!("Failed to write windows-state.json: {}", e))?;

            log::info!(
                "Removed window state for '{}' from windows-state.json ({} entries removed)",
                window_label,
                removed_count
            );
        }
    }

    Ok(())
}

fn register_window_with_cleanup<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    window_registry: &WindowRegistry,
    label: String,
    state: WindowState,
) -> Result<(), String> {
    window_registry.register_window(label.clone(), state)?;

    let registry_clone = window_registry.clone();
    let label_clone = label.clone();
    let app_handle = window.app_handle().clone();

    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            log::info!(
                "Window {} is being destroyed, cleaning up registry and state file",
                label_clone
            );

            // Clean up window registry
            if let Err(e) = registry_clone.unregister_window(&label_clone) {
                log::error!("Failed to unregister window {}: {}", label_clone, e);
            }

            // Clean up windows-state.json
            if let Err(e) = remove_window_state_from_file(&app_handle, &label_clone) {
                log::error!(
                    "Failed to remove window state from file for {}: {}",
                    label_clone,
                    e
                );
            }
        }
    });

    log::info!("Window created successfully: {}", label);
    Ok(())
}

pub fn create_window<R: Runtime>(
    app_handle: &AppHandle<R>,
    window_registry: &WindowRegistry,
    project_id: Option<String>,
    root_path: Option<String>,
    is_new_window: bool,
) -> Result<String, String> {
    // Only try to reuse existing window if not explicitly requesting a new window
    // When is_new_window is true, always create a new window even if project is already open
    if !is_new_window {
        if let Some(ref path) = root_path {
            if let Some(existing_label) =
                try_focus_existing_window(app_handle, window_registry, path)?
            {
                return Ok(existing_label);
            }
        }
    }

    // Generate unique window label
    let label = generate_window_label()?;
    let title = build_window_title(root_path.as_ref());

    log::info!(
        "Creating new window with label: {}, is_new_window: {}",
        label,
        is_new_window
    );

    // Create window with URL parameter to indicate new window
    // This is more reliable than events due to timing issues
    let url_path = if is_new_window && root_path.is_none() {
        "/?isNewWindow=true"
    } else {
        "/"
    };

    let window = WebviewWindowBuilder::new(app_handle, &label, WebviewUrl::App(url_path.into()))
        .title(&title)
        .inner_size(1200.0, 800.0)
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    // Register window in registry and set up cleanup handler
    let state = WindowState {
        project_id,
        root_path,
        file_watcher: None,
    };
    register_window_with_cleanup(&window, window_registry, label.clone(), state)?;

    Ok(label)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_registry_new() {
        let registry = WindowRegistry::new();
        let windows = registry.get_all_windows().unwrap();
        assert!(windows.is_empty());
    }

    #[test]
    fn test_register_window() {
        let registry = WindowRegistry::new();

        let state = WindowState {
            project_id: Some("project-1".to_string()),
            root_path: Some("/path/to/project".to_string()),
            file_watcher: None,
        };

        let result = registry.register_window("window-1".to_string(), state);
        assert!(result.is_ok());

        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].label, "window-1");
        assert_eq!(windows[0].project_id, Some("project-1".to_string()));
        assert_eq!(windows[0].root_path, Some("/path/to/project".to_string()));
    }

    #[test]
    fn test_unregister_window() {
        let registry = WindowRegistry::new();

        let state = WindowState {
            project_id: Some("project-1".to_string()),
            root_path: Some("/path/to/project".to_string()),
            file_watcher: None,
        };

        registry
            .register_window("window-1".to_string(), state)
            .unwrap();
        assert_eq!(registry.get_all_windows().unwrap().len(), 1);

        let result = registry.unregister_window("window-1");
        assert!(result.is_ok());
        assert!(registry.get_all_windows().unwrap().is_empty());
    }

    #[test]
    fn test_unregister_nonexistent_window() {
        let registry = WindowRegistry::new();

        // Should not error when unregistering a window that doesn't exist
        let result = registry.unregister_window("nonexistent");
        assert!(result.is_ok());
    }

    #[test]
    fn test_find_window_by_project() {
        let registry = WindowRegistry::new();

        let state1 = WindowState {
            project_id: Some("project-1".to_string()),
            root_path: Some("/path/to/project1".to_string()),
            file_watcher: None,
        };

        let state2 = WindowState {
            project_id: Some("project-2".to_string()),
            root_path: Some("/path/to/project2".to_string()),
            file_watcher: None,
        };

        registry
            .register_window("window-1".to_string(), state1)
            .unwrap();
        registry
            .register_window("window-2".to_string(), state2)
            .unwrap();

        let found = registry
            .find_window_by_project("/path/to/project1")
            .unwrap();
        assert_eq!(found, Some("window-1".to_string()));

        let found = registry
            .find_window_by_project("/path/to/project2")
            .unwrap();
        assert_eq!(found, Some("window-2".to_string()));

        let not_found = registry.find_window_by_project("/path/to/unknown").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_update_window_project() {
        let registry = WindowRegistry::new();

        let state = WindowState {
            project_id: Some("old-project".to_string()),
            root_path: Some("/old/path".to_string()),
            file_watcher: None,
        };

        registry
            .register_window("window-1".to_string(), state)
            .unwrap();

        // Update the window project
        registry
            .update_window_project(
                "window-1",
                Some("new-project".to_string()),
                Some("/new/path".to_string()),
            )
            .unwrap();

        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows[0].project_id, Some("new-project".to_string()));
        assert_eq!(windows[0].root_path, Some("/new/path".to_string()));
    }

    #[test]
    fn test_update_nonexistent_window() {
        let registry = WindowRegistry::new();

        // Should not error when updating a window that doesn't exist
        let result = registry.update_window_project(
            "nonexistent",
            Some("project".to_string()),
            Some("/path".to_string()),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_multiple_windows() {
        let registry = WindowRegistry::new();

        for i in 0..5 {
            let state = WindowState {
                project_id: Some(format!("project-{}", i)),
                root_path: Some(format!("/path/to/project{}", i)),
                file_watcher: None,
            };
            registry
                .register_window(format!("window-{}", i), state)
                .unwrap();
        }

        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 5);
    }

    #[test]
    fn test_window_info_serialization() {
        let info = WindowInfo {
            label: "window-1".to_string(),
            project_id: Some("project-1".to_string()),
            root_path: Some("/path/to/project".to_string()),
            title: "Project - TalkCody".to_string(),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"label\":\"window-1\""));
        assert!(json.contains("\"project_id\":\"project-1\""));
        assert!(json.contains("\"root_path\":\"/path/to/project\""));
        assert!(json.contains("\"title\":\"Project - TalkCody\""));

        let parsed: WindowInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.label, "window-1");
        assert_eq!(parsed.project_id, Some("project-1".to_string()));
    }

    #[test]
    fn test_window_info_with_none_values() {
        let info = WindowInfo {
            label: "window-1".to_string(),
            project_id: None,
            root_path: None,
            title: "TalkCody".to_string(),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"project_id\":null"));
        assert!(json.contains("\"root_path\":null"));

        let parsed: WindowInfo = serde_json::from_str(&json).unwrap();
        assert!(parsed.project_id.is_none());
        assert!(parsed.root_path.is_none());
    }

    #[test]
    fn test_get_all_windows_title_fallback() {
        let registry = WindowRegistry::new();

        // Window with root_path - should use project name as title
        let state_with_path = WindowState {
            project_id: None,
            root_path: Some("/path/to/project".to_string()),
            file_watcher: None,
        };
        registry
            .register_window("window-1".to_string(), state_with_path)
            .unwrap();

        // Window without root_path - should use "TalkCody" as title
        let state_without_path = WindowState {
            project_id: None,
            root_path: None,
            file_watcher: None,
        };
        registry
            .register_window("window-2".to_string(), state_without_path)
            .unwrap();

        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 2);

        // Find each window and check title
        for window in &windows {
            if window.label == "window-1" {
                assert_eq!(window.title, "project - TalkCody");
            } else if window.label == "window-2" {
                assert_eq!(window.title, "TalkCody");
            }
        }
    }

    #[test]
    fn test_build_window_title() {
        // Test with normal path - should extract project name
        assert_eq!(
            build_window_title(Some(&"/path/to/myproject".to_string())),
            "myproject - TalkCody"
        );

        // Test with None - should return "TalkCody"
        assert_eq!(build_window_title(None), "TalkCody");

        // Test with deeply nested path
        assert_eq!(
            build_window_title(Some(&"/Users/kks/mygit/talkcody".to_string())),
            "talkcody - TalkCody"
        );

        // Test with single directory name
        assert_eq!(
            build_window_title(Some(&"project".to_string())),
            "project - TalkCody"
        );

        // Test with root path only
        assert_eq!(build_window_title(Some(&"/".to_string())), "TalkCody");
    }

    #[test]
    fn test_registry_thread_safety() {
        use std::thread;

        let registry = Arc::new(WindowRegistry::new());

        // Spawn multiple threads to register windows
        let mut handles = vec![];
        for i in 0..10 {
            let registry_clone = Arc::clone(&registry);
            let handle = thread::spawn(move || {
                let state = WindowState {
                    project_id: Some(format!("project-{}", i)),
                    root_path: Some(format!("/path/{}", i)),
                    file_watcher: None,
                };
                registry_clone
                    .register_window(format!("window-{}", i), state)
                    .unwrap();
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 10);
    }

    #[test]
    fn test_cleanup_all_watchers_empty_registry() {
        // Test cleanup_all_watchers on empty registry doesn't panic
        let registry = WindowRegistry::new();
        registry.cleanup_all_watchers();
        // Should complete without panic
    }

    #[test]
    fn test_cleanup_all_watchers_no_watchers() {
        // Test cleanup_all_watchers when windows have no file watchers
        let registry = WindowRegistry::new();

        for i in 0..3 {
            let state = WindowState {
                project_id: Some(format!("project-{}", i)),
                root_path: Some(format!("/path/{}", i)),
                file_watcher: None, // No watcher
            };
            registry
                .register_window(format!("window-{}", i), state)
                .unwrap();
        }

        // Should complete without panic
        registry.cleanup_all_watchers();

        // Windows should still exist (cleanup doesn't remove them)
        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 3);
    }

    #[test]
    fn test_cleanup_all_watchers_with_watchers() {
        // Test cleanup_all_watchers properly cleans up file watchers
        let registry = WindowRegistry::new();

        // Create windows with actual file watchers
        for i in 0..3 {
            let watcher = FileWatcher::new().ok();
            let state = WindowState {
                project_id: Some(format!("project-{}", i)),
                root_path: Some(format!("/path/{}", i)),
                file_watcher: watcher,
            };
            registry
                .register_window(format!("window-{}", i), state)
                .unwrap();
        }

        // Should complete without panic and clean up all watchers
        registry.cleanup_all_watchers();

        // Windows should still exist
        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 3);
    }

    #[test]
    fn test_cleanup_all_watchers_is_idempotent() {
        // Test that calling cleanup_all_watchers multiple times is safe
        let registry = WindowRegistry::new();

        for i in 0..2 {
            let watcher = FileWatcher::new().ok();
            let state = WindowState {
                project_id: Some(format!("project-{}", i)),
                root_path: Some(format!("/path/{}", i)),
                file_watcher: watcher,
            };
            registry
                .register_window(format!("window-{}", i), state)
                .unwrap();
        }

        // Call cleanup multiple times - should not panic
        registry.cleanup_all_watchers();
        registry.cleanup_all_watchers();
        registry.cleanup_all_watchers();
    }

    #[test]
    fn test_cleanup_all_watchers_thread_safety() {
        use std::thread;

        let registry = Arc::new(WindowRegistry::new());

        // Register windows with watchers
        for i in 0..5 {
            let watcher = FileWatcher::new().ok();
            let state = WindowState {
                project_id: Some(format!("project-{}", i)),
                root_path: Some(format!("/path/{}", i)),
                file_watcher: watcher,
            };
            registry
                .register_window(format!("window-{}", i), state)
                .unwrap();
        }

        // Call cleanup from multiple threads
        let mut handles = vec![];
        for _ in 0..3 {
            let registry_clone = Arc::clone(&registry);
            let handle = thread::spawn(move || {
                registry_clone.cleanup_all_watchers();
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        // Should complete without panic or deadlock
    }

    #[test]
    fn test_set_window_file_watcher_then_cleanup() {
        // Test the interaction between set_window_file_watcher and cleanup_all_watchers
        let registry = WindowRegistry::new();

        // Register window without watcher
        let state = WindowState {
            project_id: Some("project-1".to_string()),
            root_path: Some("/path/1".to_string()),
            file_watcher: None,
        };
        registry
            .register_window("window-1".to_string(), state)
            .unwrap();

        // Add watcher via set_window_file_watcher
        let watcher = FileWatcher::new().unwrap();
        registry
            .set_window_file_watcher("window-1", Some(watcher))
            .unwrap();

        // Cleanup should handle this correctly
        registry.cleanup_all_watchers();

        // Window should still exist
        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 1);
    }

    // Tests for multi-window independent file watcher support
    #[test]
    fn test_multiple_windows_have_independent_watchers() {
        // Test that each window can have its own independent file watcher
        let registry = WindowRegistry::new();

        // Create 3 windows, each with its own watcher
        for i in 0..3 {
            let state = WindowState {
                project_id: Some(format!("project-{}", i)),
                root_path: Some(format!("/path/to/project{}", i)),
                file_watcher: None,
            };
            registry
                .register_window(format!("window-{}", i), state)
                .unwrap();

            // Add a watcher for each window
            let watcher = FileWatcher::new().unwrap();
            registry
                .set_window_file_watcher(&format!("window-{}", i), Some(watcher))
                .unwrap();
        }

        // Verify all windows exist
        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 3);

        // Setting watcher for one window should not affect others
        // (This is verified by the fact that we can set watchers for all windows without errors)
    }

    #[test]
    fn test_setting_watcher_for_one_window_does_not_affect_others() {
        // Test that setting a watcher for one window doesn't stop watchers in other windows
        let registry = WindowRegistry::new();

        // Create two windows with watchers
        for i in 0..2 {
            let state = WindowState {
                project_id: Some(format!("project-{}", i)),
                root_path: Some(format!("/path/{}", i)),
                file_watcher: None,
            };
            registry
                .register_window(format!("window-{}", i), state)
                .unwrap();

            let watcher = FileWatcher::new().unwrap();
            registry
                .set_window_file_watcher(&format!("window-{}", i), Some(watcher))
                .unwrap();
        }

        // Replace watcher for window-0
        let new_watcher = FileWatcher::new().unwrap();
        registry
            .set_window_file_watcher("window-0", Some(new_watcher))
            .unwrap();

        // Both windows should still exist (replacing watcher shouldn't affect other windows)
        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 2);
    }

    #[test]
    fn test_unregister_window_stops_its_watcher() {
        // Test that unregistering a window properly stops its file watcher
        let registry = WindowRegistry::new();

        // Create a window with a watcher
        let state = WindowState {
            project_id: Some("project-1".to_string()),
            root_path: Some("/path/1".to_string()),
            file_watcher: None,
        };
        registry
            .register_window("window-1".to_string(), state)
            .unwrap();

        let watcher = FileWatcher::new().unwrap();
        registry
            .set_window_file_watcher("window-1", Some(watcher))
            .unwrap();

        // Unregister the window (this should stop the watcher via WindowState cleanup)
        registry.unregister_window("window-1").unwrap();

        // Window should no longer exist
        let windows = registry.get_all_windows().unwrap();
        assert!(windows.is_empty());
    }

    #[test]
    fn test_replace_watcher_stops_old_watcher() {
        // Test that setting a new watcher properly stops the old one
        let registry = WindowRegistry::new();

        let state = WindowState {
            project_id: Some("project-1".to_string()),
            root_path: Some("/path/1".to_string()),
            file_watcher: None,
        };
        registry
            .register_window("window-1".to_string(), state)
            .unwrap();

        // Set initial watcher
        let watcher1 = FileWatcher::new().unwrap();
        registry
            .set_window_file_watcher("window-1", Some(watcher1))
            .unwrap();

        // Replace with new watcher - old one should be stopped
        let watcher2 = FileWatcher::new().unwrap();
        registry
            .set_window_file_watcher("window-1", Some(watcher2))
            .unwrap();

        // Replace again
        let watcher3 = FileWatcher::new().unwrap();
        registry
            .set_window_file_watcher("window-1", Some(watcher3))
            .unwrap();

        // Should not panic and window should still exist
        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 1);
    }

    #[test]
    fn test_clear_watcher_by_setting_none() {
        // Test that we can clear a watcher by setting None
        let registry = WindowRegistry::new();

        let state = WindowState {
            project_id: Some("project-1".to_string()),
            root_path: Some("/path/1".to_string()),
            file_watcher: None,
        };
        registry
            .register_window("window-1".to_string(), state)
            .unwrap();

        // Set a watcher
        let watcher = FileWatcher::new().unwrap();
        registry
            .set_window_file_watcher("window-1", Some(watcher))
            .unwrap();

        // Clear the watcher by setting None
        registry.set_window_file_watcher("window-1", None).unwrap();

        // Window should still exist
        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 1);
    }

    #[test]
    fn test_multiple_windows_with_different_projects() {
        // Simulate real-world scenario: multiple windows open with different projects
        let registry = WindowRegistry::new();

        // Window 1: TalkCody project
        let state1 = WindowState {
            project_id: Some("talkcody".to_string()),
            root_path: Some("/Users/kks/mygit/talkcody".to_string()),
            file_watcher: None,
        };
        registry
            .register_window("window-talkcody".to_string(), state1)
            .unwrap();
        let watcher1 = FileWatcher::new().unwrap();
        registry
            .set_window_file_watcher("window-talkcody", Some(watcher1))
            .unwrap();

        // Window 2: Trader project
        let state2 = WindowState {
            project_id: Some("trader".to_string()),
            root_path: Some("/Users/kks/mygit/trader".to_string()),
            file_watcher: None,
        };
        registry
            .register_window("window-trader".to_string(), state2)
            .unwrap();
        let watcher2 = FileWatcher::new().unwrap();
        registry
            .set_window_file_watcher("window-trader", Some(watcher2))
            .unwrap();

        // Both windows should exist with their own watchers
        let windows = registry.get_all_windows().unwrap();
        assert_eq!(windows.len(), 2);

        // Verify project paths are correct
        let talkcody_window = windows.iter().find(|w| w.label == "window-talkcody");
        let trader_window = windows.iter().find(|w| w.label == "window-trader");

        assert!(talkcody_window.is_some());
        assert!(trader_window.is_some());
        assert_eq!(
            talkcody_window.unwrap().root_path,
            Some("/Users/kks/mygit/talkcody".to_string())
        );
        assert_eq!(
            trader_window.unwrap().root_path,
            Some("/Users/kks/mygit/trader".to_string())
        );
    }
}
