use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::file_watcher::FileWatcher;

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
        let watcher = {
            let mut windows = self.windows.lock().map_err(|e| e.to_string())?;
            windows.remove(label).and_then(|mut state| state.file_watcher.take())
        };

        if let Some(mut watcher) = watcher {
            watcher.stop();
        }

        Ok(())
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
        let old_watcher = {
            let mut windows = self.windows.lock().map_err(|e| e.to_string())?;
            if let Some(state) = windows.get_mut(label) {
                let old = state.file_watcher.take();
                state.file_watcher = watcher;
                old
            } else {
                None
            }
        };

        if let Some(mut old_watcher) = old_watcher {
            old_watcher.stop();
        }

        Ok(())
    }

    /// Stop all file watchers across all windows.
    /// This should be called when the application exits to release file handles.
    pub fn cleanup_all_watchers(&self) {
        log::info!("Cleaning up all window file watchers");
        let watchers: Vec<(String, FileWatcher)> = if let Ok(mut windows) = self.windows.lock() {
            windows
                .iter_mut()
                .filter_map(|(label, state)| {
                    state.file_watcher.take().map(|watcher| (label.clone(), watcher))
                })
                .collect()
        } else {
            log::error!("Failed to acquire lock for cleanup_all_watchers");
            return;
        };

        for (label, mut watcher) in watchers {
            log::info!("Stopping file watcher for window: {}", label);
            watcher.stop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn test_window_registry_new() {
        let registry = WindowRegistry::new();
        registry.cleanup_all_watchers();
    }

    #[test]
    fn test_register_and_update_window_project() {
        let registry = WindowRegistry::new();

        registry
            .register_window(
                "window-1".to_string(),
                WindowState {
                    project_id: Some("project-1".to_string()),
                    root_path: Some("/path/to/project".to_string()),
                    file_watcher: None,
                },
            )
            .unwrap();

        registry
            .update_window_project(
                "window-1",
                Some("project-2".to_string()),
                Some("/new/path".to_string()),
            )
            .unwrap();

        let windows = registry.windows.lock().unwrap();
        let state = windows.get("window-1").unwrap();
        assert_eq!(state.project_id.as_deref(), Some("project-2"));
        assert_eq!(state.root_path.as_deref(), Some("/new/path"));
    }

    #[test]
    fn test_unregister_window() {
        let registry = WindowRegistry::new();

        registry
            .register_window(
                "window-1".to_string(),
                WindowState {
                    project_id: None,
                    root_path: None,
                    file_watcher: None,
                },
            )
            .unwrap();

        registry.unregister_window("window-1").unwrap();

        let windows = registry.windows.lock().unwrap();
        assert!(!windows.contains_key("window-1"));
    }

    #[test]
    fn test_update_nonexistent_window_is_noop() {
        let registry = WindowRegistry::new();
        let result = registry.update_window_project(
            "missing",
            Some("project".to_string()),
            Some("/path".to_string()),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_cleanup_all_watchers_thread_safety() {
        use std::thread;

        let registry = Arc::new(WindowRegistry::new());

        for i in 0..3 {
            registry
                .register_window(
                    format!("window-{}", i),
                    WindowState {
                        project_id: Some(format!("project-{}", i)),
                        root_path: Some(format!("/path/{}", i)),
                        file_watcher: FileWatcher::new().ok(),
                    },
                )
                .unwrap();
        }

        let mut handles = vec![];
        for _ in 0..5 {
            let registry_clone = Arc::clone(&registry);
            handles.push(thread::spawn(move || {
                registry_clone.cleanup_all_watchers();
            }));
        }

        for handle in handles {
            handle.join().unwrap();
        }
    }
}
