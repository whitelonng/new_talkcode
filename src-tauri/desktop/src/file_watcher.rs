use crate::constants::{BINARY_EXTENSIONS, EXCLUDED_DIRS};
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc,
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub struct FileWatcher {
    _watcher: RecommendedWatcher,
    _thread_handle: Option<JoinHandle<()>>,
    _stop_flag: Arc<AtomicBool>,
    // Git watcher (separate from main file watcher)
    _git_watcher: Option<RecommendedWatcher>,
    _git_thread_handle: Option<JoinHandle<()>>,
    _git_stop_flag: Arc<AtomicBool>,
}

impl FileWatcher {
    pub fn new() -> notify::Result<Self> {
        // Create a dummy watcher initially
        let (sender, _receiver) = mpsc::channel();
        let watcher = RecommendedWatcher::new(
            move |result| {
                if let Err(e) = sender.send(result) {
                    log::error!("Failed to send file watcher event: {}", e);
                }
            },
            Config::default(),
        )?;

        Ok(Self {
            _watcher: watcher,
            _thread_handle: None,
            _stop_flag: Arc::new(AtomicBool::new(false)),
            _git_watcher: None,
            _git_thread_handle: None,
            _git_stop_flag: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Watch a directory for file changes
    /// If window_label is provided, events will be emitted only to that specific window
    /// Otherwise, events will be broadcast to all windows
    pub fn watch_directory<P: AsRef<Path>>(
        &mut self,
        path: P,
        app_handle: AppHandle,
        window_label: Option<String>,
    ) -> notify::Result<()> {
        // Stop any existing watcher first
        self.stop();

        let repo_path = path.as_ref().to_path_buf();

        let (sender, receiver) = mpsc::channel();

        // Create a new watcher
        let mut watcher = RecommendedWatcher::new(
            move |result| {
                if let Err(e) = sender.send(result) {
                    log::error!("Failed to send file watcher event: {}", e);
                }
            },
            Config::default(),
        )?;

        // Start watching
        watcher.watch(path.as_ref(), RecursiveMode::Recursive)?;

        // Replace the old watcher
        self._watcher = watcher;

        // Create new stop flag
        self._stop_flag = Arc::new(AtomicBool::new(false));
        let stop_flag = Arc::clone(&self._stop_flag);

        // Clone app_handle and window_label for the file watcher thread
        let file_app_handle = app_handle.clone();
        let file_window_label = window_label.clone();

        // Spawn thread to handle events with proper trailing-edge debounce
        let thread_handle = thread::spawn(move || {
            let debounce_duration = Duration::from_millis(500);
            let check_interval = Duration::from_millis(100);

            // Trailing-edge debounce state
            let mut pending_emit = false;
            let mut last_event_time = Instant::now();
            let mut pending_paths: Vec<std::path::PathBuf> = Vec::new();

            loop {
                // Check stop flag first
                if stop_flag.load(Ordering::Relaxed) {
                    log::info!("File watcher thread stopping");
                    break;
                }

                // Use short timeout to allow checking for pending events
                match receiver.recv_timeout(check_interval) {
                    Ok(Ok(event)) => {
                        // Filter events we care about
                        match event.kind {
                            notify::EventKind::Create(_)
                            | notify::EventKind::Remove(_)
                            | notify::EventKind::Modify(notify::event::ModifyKind::Name(_))
                            | notify::EventKind::Modify(notify::event::ModifyKind::Data(_)) => {
                                // Check if the event is for files we care about
                                let relevant_paths: Vec<_> = event
                                    .paths
                                    .iter()
                                    .filter(|path| Self::should_watch_path(path))
                                    .cloned()
                                    .collect();

                                if !relevant_paths.is_empty() {
                                    // Mark pending and update last event time
                                    pending_emit = true;
                                    last_event_time = Instant::now();
                                    // Collect paths for logging/debugging
                                    pending_paths.extend(relevant_paths);
                                }
                            }
                            _ => {}
                        }
                    }
                    Ok(Err(e)) => {
                        log::error!("File watcher error: {}", e);
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // Normal timeout - check if we should emit pending event
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        log::info!("File watcher channel disconnected");
                        break;
                    }
                }

                // Check if we should emit the pending event (trailing-edge debounce)
                // Emit after debounce_duration has passed since the last event
                if pending_emit {
                    let elapsed = Instant::now().duration_since(last_event_time);
                    if elapsed >= debounce_duration {
                        log::debug!(
                            "Emitting debounced file-system-changed event for {} paths to {:?}",
                            pending_paths.len(),
                            file_window_label
                        );

                        // Emit to specific window if label provided, otherwise broadcast
                        let result = if let Some(ref label) = file_window_label {
                            file_app_handle.emit_to(label, "file-system-changed", &pending_paths)
                        } else {
                            file_app_handle.emit("file-system-changed", &pending_paths)
                        };

                        if let Err(e) = result {
                            log::error!("Failed to emit file system change event: {}", e);
                        }
                        pending_emit = false;
                        pending_paths.clear();
                    }
                }
            }
        });

        self._thread_handle = Some(thread_handle);

        // Also start watching the .git directory for git status changes
        self.watch_git_directory(&repo_path, app_handle, window_label)?;

        Ok(())
    }

    /// Watch the .git directory for git status changes
    /// If window_label is provided, events will be emitted only to that specific window
    fn watch_git_directory<P: AsRef<Path>>(
        &mut self,
        repo_path: P,
        app_handle: AppHandle,
        window_label: Option<String>,
    ) -> notify::Result<()> {
        let git_path = repo_path.as_ref().join(".git");

        if !git_path.exists() {
            log::info!(
                "No .git directory found at {:?}, skipping git watcher",
                git_path
            );
            return Ok(());
        }

        log::info!(
            "Starting git directory watcher for: {:?} (window: {:?})",
            git_path,
            window_label
        );

        // Stop any existing git watcher
        self.stop_git_watcher();

        let (sender, receiver) = mpsc::channel();

        // Create a new watcher for .git directory
        let mut watcher = RecommendedWatcher::new(
            move |result| {
                if let Err(e) = sender.send(result) {
                    log::error!("Failed to send git watcher event: {}", e);
                }
            },
            Config::default(),
        )?;

        // Watch the .git directory recursively
        watcher.watch(&git_path, RecursiveMode::Recursive)?;

        self._git_watcher = Some(watcher);

        // Create new stop flag for git watcher
        self._git_stop_flag = Arc::new(AtomicBool::new(false));
        let stop_flag = Arc::clone(&self._git_stop_flag);

        // Spawn thread to handle git events with proper trailing-edge debounce
        let git_thread_handle = thread::spawn(move || {
            let debounce_duration = Duration::from_millis(500);
            let check_interval = Duration::from_millis(100);

            // Trailing-edge debounce state
            let mut pending_emit = false;
            let mut last_event_time = Instant::now();

            loop {
                // Check stop flag first
                if stop_flag.load(Ordering::Relaxed) {
                    log::info!("Git watcher thread stopping");
                    break;
                }

                // Use short timeout to allow checking for pending events
                match receiver.recv_timeout(check_interval) {
                    Ok(Ok(event)) => {
                        // Check if this is a git status-related file change
                        let is_git_status_change = event
                            .paths
                            .iter()
                            .any(|path| Self::is_git_status_file(path));

                        if is_git_status_change {
                            log::debug!("Git status change detected: {:?}", event.paths);
                            // Mark pending and update last event time (trailing-edge debounce)
                            pending_emit = true;
                            last_event_time = Instant::now();
                        }
                    }
                    Ok(Err(e)) => {
                        log::error!("Git watcher error: {}", e);
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // Normal timeout - check if we should emit pending event
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        log::info!("Git watcher channel disconnected");
                        break;
                    }
                }

                // Check if we should emit the pending event (trailing-edge debounce)
                // Emit after debounce_duration has passed since the last event
                if pending_emit {
                    let elapsed = Instant::now().duration_since(last_event_time);
                    if elapsed >= debounce_duration {
                        log::info!(
                            "Emitting debounced git-status-changed event to {:?}",
                            window_label
                        );

                        // Emit to specific window if label provided, otherwise broadcast
                        let result = if let Some(ref label) = window_label {
                            app_handle.emit_to(label, "git-status-changed", ())
                        } else {
                            app_handle.emit("git-status-changed", ())
                        };

                        if let Err(e) = result {
                            log::error!("Failed to emit git-status-changed event: {}", e);
                        }
                        pending_emit = false;
                    }
                }
            }
        });

        self._git_thread_handle = Some(git_thread_handle);

        Ok(())
    }

    /// Stop the git watcher
    fn stop_git_watcher(&mut self) {
        // Set stop flag to signal thread to exit
        self._git_stop_flag.store(true, Ordering::Relaxed);

        // Drop the watcher first to close the watch
        self._git_watcher = None;

        // Wait for thread to finish
        if let Some(handle) = self._git_thread_handle.take() {
            if let Err(e) = handle.join() {
                log::error!("Failed to join git watcher thread: {:?}", e);
            }
        }
    }

    /// Stop the file watcher and wait for thread to finish
    pub fn stop(&mut self) {
        // Stop git watcher first
        self.stop_git_watcher();

        // Set stop flag to signal thread to exit
        self._stop_flag.store(true, Ordering::Relaxed);

        // Wait for thread to finish
        if let Some(handle) = self._thread_handle.take() {
            if let Err(e) = handle.join() {
                log::error!("Failed to join file watcher thread: {:?}", e);
            }
        }
    }

    /// Check if a path should be watched (not ignored)
    fn should_watch_path(path: &Path) -> bool {
        // Check if any component of the path is in EXCLUDED_DIRS
        for component in path.components() {
            if let Some(name) = component.as_os_str().to_str() {
                if EXCLUDED_DIRS.contains(&name) {
                    return false;
                }
            }
        }

        // Check file extensions to ignore
        if let Some(extension) = path.extension() {
            let ext_str = extension.to_string_lossy().to_lowercase();

            // Check binary extensions (includes Rust build artifacts: .rlib, .d, .rmeta, etc.)
            if BINARY_EXTENSIONS.contains(&ext_str.as_str()) {
                return false;
            }

            // Check temporary/system file extensions
            let ignore_extensions = [
                "tmp",
                "temp",
                "log",
                "lock",
                "cache",
                "swp",
                "swo",
                "bak",
                "DS_Store",
                "Thumbs.db",
                "desktop.ini",
            ];

            if ignore_extensions.contains(&ext_str.as_str()) {
                return false;
            }
        }

        true
    }

    /// Check if a path is a git status-related file
    fn is_git_status_file(path: &Path) -> bool {
        let path_str = path.to_string_lossy();

        // Ignore lock files - they are temporary and don't indicate status changes
        if path_str.ends_with(".lock") {
            return false;
        }

        // Files that indicate git status changes
        // .git/index - staging area changes (git add/reset)
        // .git/HEAD - current branch changes (git checkout)
        // .git/refs/heads/* - local branch commit changes (git commit)
        // .git/refs/remotes/* - remote branch changes (git fetch/pull)
        // .git/MERGE_HEAD - merge state
        // .git/REBASE_HEAD - rebase state
        // .git/CHERRY_PICK_HEAD - cherry-pick state
        // .git/ORIG_HEAD - original head before dangerous operations

        if path_str.ends_with(".git/index")
            || (path_str.contains(".git/index") && !path_str.ends_with(".lock"))
        {
            return true;
        }
        // Only match .git/HEAD, not logs/HEAD or other HEAD files
        if path_str.ends_with(".git/HEAD") {
            return true;
        }
        if path_str.contains(".git/refs/heads/") {
            return true;
        }
        if path_str.contains(".git/refs/remotes/") {
            return true;
        }
        if path_str.ends_with("MERGE_HEAD")
            || path_str.ends_with("REBASE_HEAD")
            || path_str.ends_with("CHERRY_PICK_HEAD")
            || path_str.ends_with("ORIG_HEAD")
        {
            return true;
        }

        false
    }
}

impl Drop for FileWatcher {
    fn drop(&mut self) {
        log::info!("FileWatcher being dropped, stopping watchers");
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_git_status_file_matches_index() {
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/index"
        )));
    }

    #[test]
    fn test_is_git_status_file_matches_head() {
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/HEAD"
        )));
        // refs/heads/HEAD is actually a branch named HEAD (rare but valid), still matches via refs/heads/
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/refs/heads/HEAD"
        )));
    }

    #[test]
    fn test_is_git_status_file_matches_refs_heads() {
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/refs/heads/main"
        )));
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/refs/heads/feature/branch"
        )));
    }

    #[test]
    fn test_is_git_status_file_matches_refs_remotes() {
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/refs/remotes/origin/main"
        )));
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/refs/remotes/upstream/develop"
        )));
    }

    #[test]
    fn test_is_git_status_file_matches_special_heads() {
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/MERGE_HEAD"
        )));
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/REBASE_HEAD"
        )));
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/CHERRY_PICK_HEAD"
        )));
        assert!(FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/ORIG_HEAD"
        )));
    }

    #[test]
    fn test_is_git_status_file_ignores_lock_files() {
        assert!(!FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/index.lock"
        )));
        assert!(!FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/refs/heads/main.lock"
        )));
        assert!(!FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/HEAD.lock"
        )));
    }

    #[test]
    fn test_is_git_status_file_ignores_other_git_files() {
        assert!(!FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/config"
        )));
        assert!(!FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/description"
        )));
        assert!(!FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/objects/pack/pack-abc.idx"
        )));
        assert!(!FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/COMMIT_EDITMSG"
        )));
        assert!(!FileWatcher::is_git_status_file(Path::new(
            "/repo/.git/logs/HEAD"
        )));
    }

    #[test]
    fn test_should_watch_path_normal_files() {
        assert!(FileWatcher::should_watch_path(Path::new(
            "/repo/src/main.rs"
        )));
        assert!(FileWatcher::should_watch_path(Path::new(
            "/repo/package.json"
        )));
        assert!(FileWatcher::should_watch_path(Path::new("/repo/README.md")));
    }

    #[test]
    fn test_should_watch_path_excludes_node_modules() {
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/node_modules/package/index.js"
        )));
    }

    #[test]
    fn test_should_watch_path_excludes_git_dir() {
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/.git/objects/abc"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/.git/config"
        )));
    }

    #[test]
    fn test_should_watch_path_excludes_target_dir() {
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/target/debug/deps/lib.rlib"
        )));
    }

    #[test]
    fn test_should_watch_path_excludes_temp_files() {
        assert!(!FileWatcher::should_watch_path(Path::new("/repo/file.tmp")));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/file.temp"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new("/repo/file.swp")));
        assert!(!FileWatcher::should_watch_path(Path::new("/repo/file.bak")));
    }

    #[test]
    fn test_should_watch_path_excludes_log_files() {
        assert!(!FileWatcher::should_watch_path(Path::new("/repo/app.log")));
    }

    #[test]
    fn test_should_watch_path_excludes_lock_files() {
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/package-lock.json.lock"
        )));
        // Note: package-lock.json itself should be watched as it has .json extension
        assert!(FileWatcher::should_watch_path(Path::new(
            "/repo/package-lock.json"
        )));
    }

    #[test]
    fn test_should_watch_path_excludes_target_dev_dir() {
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/src-tauri/target-dev/debug/libtauri_app_lib.a"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/src-tauri/target-dev/debug/libtauri_app_lib.rlib"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/src-tauri/target-dev/debug/libtauri_app_lib.dylib"
        )));
    }

    #[test]
    fn test_should_watch_path_excludes_rust_binary_extensions() {
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/target/debug/deps/lib.rlib"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/target/debug/deps/lib.d"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/target/debug/deps/lib.rmeta"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/target/debug/app.pdb"
        )));
    }

    #[test]
    fn test_should_watch_path_excludes_common_binary_files() {
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/build/lib.a"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/build/lib.dylib"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/build/lib.so"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/build/app.exe"
        )));
        assert!(!FileWatcher::should_watch_path(Path::new(
            "/repo/build/lib.dll"
        )));
    }

    #[test]
    fn test_should_watch_path_allows_source_files() {
        // Ensure Rust source files are still watched
        assert!(FileWatcher::should_watch_path(Path::new(
            "/repo/src/main.rs"
        )));
        assert!(FileWatcher::should_watch_path(Path::new(
            "/repo/src/lib.rs"
        )));
        assert!(FileWatcher::should_watch_path(Path::new(
            "/repo/Cargo.toml"
        )));
        // Ensure other source files are watched
        assert!(FileWatcher::should_watch_path(Path::new(
            "/repo/src/index.ts"
        )));
        assert!(FileWatcher::should_watch_path(Path::new(
            "/repo/package.json"
        )));
        assert!(FileWatcher::should_watch_path(Path::new("/repo/README.md")));
    }

    // Test for trailing-edge debounce behavior simulation
    #[test]
    fn test_trailing_edge_debounce_logic() {
        let debounce_duration = Duration::from_millis(500);

        // Simulate rapid events
        let events = vec![
            (Duration::from_millis(0), "event1"),
            (Duration::from_millis(100), "event2"),
            (Duration::from_millis(200), "event3"),
            (Duration::from_millis(300), "event4"),
        ];

        let mut pending_emit = false;
        let mut last_event_time = Instant::now();
        let mut emit_count = 0;

        // Process events
        for (delay, _name) in &events {
            std::thread::sleep(*delay);
            // Simulate receiving event
            pending_emit = true;
            last_event_time = Instant::now();
        }

        // Simulate waiting for debounce
        std::thread::sleep(debounce_duration);

        // Check if should emit
        if pending_emit && Instant::now().duration_since(last_event_time) >= debounce_duration {
            emit_count += 1;
            pending_emit = false;
        }

        // With trailing-edge debounce, we should emit exactly once after all events
        assert_eq!(
            emit_count, 1,
            "Should emit exactly once after debounce window"
        );
        assert!(!pending_emit, "Pending flag should be cleared after emit");
    }

    #[test]
    fn test_file_watcher_new_creates_valid_instance() {
        // Test that FileWatcher::new() creates a valid instance
        let watcher = FileWatcher::new();
        assert!(watcher.is_ok(), "FileWatcher::new() should succeed");
    }

    #[test]
    fn test_file_watcher_stop_is_idempotent() {
        // Test that calling stop() multiple times doesn't panic
        let mut watcher = FileWatcher::new().unwrap();
        watcher.stop();
        watcher.stop(); // Second call should not panic
        watcher.stop(); // Third call should not panic
    }

    #[test]
    fn test_file_watcher_drop_calls_stop() {
        // Test that Drop trait properly cleans up resources
        // This test verifies that the FileWatcher can be dropped without panicking
        {
            let _watcher = FileWatcher::new().unwrap();
            // watcher will be dropped here
        }
        // If we reach here without panic, the Drop impl worked correctly
    }

    #[test]
    fn test_file_watcher_drop_after_stop() {
        // Test that Drop works correctly even after manual stop() call
        {
            let mut watcher = FileWatcher::new().unwrap();
            watcher.stop();
            // watcher will be dropped here, stop() will be called again via Drop
        }
        // If we reach here without panic, the Drop impl handled double-stop correctly
    }

    #[test]
    fn test_multiple_file_watchers_can_be_created_and_dropped() {
        // Test that multiple FileWatcher instances can coexist and be dropped
        let mut watchers = Vec::new();
        for _ in 0..5 {
            watchers.push(FileWatcher::new().unwrap());
        }
        // All watchers will be dropped here
        drop(watchers);
        // If we reach here without panic, multiple watchers were handled correctly
    }
}
