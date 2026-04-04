// keep_awake.rs - Keep awake service for preventing system sleep during task execution
//
// This module provides reference-counted sleep prevention to handle concurrent tasks:
// - Multiple tasks can request sleep prevention
// - Sleep is prevented while any task is active
// - Sleep is allowed when all tasks complete (refcount reaches 0)

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::State;

#[cfg(target_os = "linux")]
use which::which;

#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Power::{
    SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
};

/// State wrapper for keep awake functionality
pub struct KeepAwakeStateWrapper {
    state: KeepAwakeState,
}

impl KeepAwakeStateWrapper {
    pub fn new() -> Self {
        Self {
            state: KeepAwakeState::new(),
        }
    }
}

impl Default for KeepAwakeStateWrapper {
    fn default() -> Self {
        Self::new()
    }
}

/// Keep awake state with reference counting
///
/// Thread-safe reference counter for managing sleep prevention requests.
/// Only allows sleep when the reference count reaches zero.
pub struct KeepAwakeState {
    /// Number of active sleep prevention requests
    ref_count: Mutex<u32>,
    process: Mutex<Option<KeepAwakeProcess>>,
    process_enabled: bool,
}

impl KeepAwakeState {
    /// Create a new KeepAwakeState
    pub fn new() -> Self {
        Self {
            ref_count: Mutex::new(0),
            process: Mutex::new(None),
            process_enabled: true,
        }
    }

    #[cfg(test)]
    pub fn new_for_tests() -> Self {
        Self {
            ref_count: Mutex::new(0),
            process: Mutex::new(None),
            process_enabled: false,
        }
    }

    /// Acquire sleep prevention (increment reference count)
    ///
    /// Returns true if this was the first request (sleep prevention was just enabled)
    /// Returns false if sleep prevention was already active
    pub fn acquire(&self) -> Result<bool, String> {
        let was_first = {
            let mut count = self.ref_count.lock().expect("KeepAwakeState lock poisoned");
            *count += 1;
            *count == 1
        };

        if was_first {
            log::info!("KeepAwake: acquire - first request");
            if self.process_enabled {
                if let Err(err) = self.start_keep_awake() {
                    let mut count = self.ref_count.lock().expect("KeepAwakeState lock poisoned");
                    if *count > 0 {
                        *count -= 1;
                    }
                    return Err(err);
                }
            }
        } else {
            let count = self.ref_count.lock().expect("KeepAwakeState lock poisoned");
            log::info!("KeepAwake: acquire - ref_count = {}", *count);
        }

        Ok(was_first)
    }

    /// Release sleep prevention (decrement reference count)
    ///
    /// Returns true if this was the last release (sleep prevention can now be disabled)
    /// Returns false if other tasks are still active
    ///
    /// Note: This function does not allow ref_count to go below zero.
    /// Calling release when ref_count is 0 will return false and log a warning.
    pub fn release(&self) -> Result<bool, String> {
        let was_last = {
            let mut count = self.ref_count.lock().expect("KeepAwakeState lock poisoned");
            if *count == 0 {
                log::warn!("KeepAwake: release called when ref_count is already 0");
                return Ok(false);
            }
            *count -= 1;
            *count == 0
        };

        if was_last {
            log::info!("KeepAwake: release - last request");
            if self.process_enabled {
                self.stop_keep_awake()?;
            }
        } else {
            let count = self.ref_count.lock().expect("KeepAwakeState lock poisoned");
            log::info!("KeepAwake: release - ref_count = {}", *count);
        }

        Ok(was_last)
    }

    fn start_keep_awake(&self) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            return self.start_keep_awake_windows();
        }
        #[cfg(target_os = "macos")]
        {
            self.start_keep_awake_macos()
        }
        #[cfg(target_os = "linux")]
        {
            return self.start_keep_awake_linux();
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            log::warn!("KeepAwake: unsupported platform, skipping");
            Ok(())
        }
    }

    fn stop_keep_awake(&self) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            return self.stop_keep_awake_windows();
        }
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            self.stop_keep_awake_process()
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Ok(())
        }
    }

    #[cfg(target_os = "macos")]
    fn start_keep_awake_macos(&self) -> Result<(), String> {
        self.spawn_keep_awake_process("caffeinate", &["-dimsu"])
    }

    #[cfg(target_os = "linux")]
    fn start_keep_awake_linux(&self) -> Result<(), String> {
        if which("systemd-inhibit").is_err() {
            log::warn!("KeepAwake: systemd-inhibit not found; skipping keep-awake");
            return Ok(());
        }

        self.spawn_keep_awake_process(
            "systemd-inhibit",
            &[
                "--what=sleep",
                "--why=TalkCody keep-awake",
                "--mode=block",
                "sleep",
                "2147483647",
            ],
        )
    }

    #[cfg(target_os = "windows")]
    fn start_keep_awake_windows(&self) -> Result<(), String> {
        let flags = ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED;
        self.set_windows_execution_state(flags)
    }

    #[cfg(target_os = "windows")]
    fn stop_keep_awake_windows(&self) -> Result<(), String> {
        self.set_windows_execution_state(ES_CONTINUOUS)
    }

    #[cfg(target_os = "windows")]
    fn set_windows_execution_state(&self, flags: u32) -> Result<(), String> {
        let result = unsafe { SetThreadExecutionState(flags) };
        if result == 0 {
            return Err(format!(
                "SetThreadExecutionState failed: {}",
                std::io::Error::last_os_error()
            ));
        }
        Ok(())
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    fn spawn_keep_awake_process(&self, command: &str, args: &[&str]) -> Result<(), String> {
        let mut process_guard = self.process.lock().expect("KeepAwakeState lock poisoned");
        if process_guard.is_some() {
            return Ok(());
        }

        let child = Command::new(command)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|err| format!("Failed to start keep-awake process: {err}"))?;

        *process_guard = Some(KeepAwakeProcess::Child(child));
        Ok(())
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    fn stop_keep_awake_process(&self) -> Result<(), String> {
        let mut process_guard = self.process.lock().expect("KeepAwakeState lock poisoned");
        if let Some(KeepAwakeProcess::Child(mut child)) = process_guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        Ok(())
    }

    /// Get current reference count
    pub fn ref_count(&self) -> u32 {
        *self.ref_count.lock().expect("KeepAwakeState lock poisoned")
    }

    /// Check if sleep is currently being prevented
    pub fn is_preventing_sleep(&self) -> bool {
        self.ref_count() > 0
    }
}

impl Default for KeepAwakeState {
    fn default() -> Self {
        Self::new()
    }
}

enum KeepAwakeProcess {
    Child(Child),
}

/// Tauri command to acquire sleep prevention
///
/// This command is called when a task starts and needs to prevent system sleep.
/// Returns true if sleep prevention was just enabled (first request).
/// Returns false if sleep prevention was already active.
#[tauri::command]
pub fn keep_awake_acquire(state: State<KeepAwakeStateWrapper>) -> Result<bool, String> {
    log::info!("keep_awake_acquire called");
    state.state.acquire()
}

/// Tauri command to release sleep prevention
///
/// This command is called when a task completes and no longer needs to prevent system sleep.
/// Returns true if sleep prevention can now be disabled (last release).
/// Returns false if other tasks are still active.
#[tauri::command]
pub fn keep_awake_release(state: State<KeepAwakeStateWrapper>) -> Result<bool, String> {
    log::info!("keep_awake_release called");
    state.state.release()
}

/// Get current reference count (for debugging)
#[tauri::command]
pub fn keep_awake_get_ref_count(state: State<KeepAwakeStateWrapper>) -> Result<u32, String> {
    Ok(state.state.ref_count())
}

/// Check if sleep is currently being prevented
#[tauri::command]
pub fn keep_awake_is_preventing(state: State<KeepAwakeStateWrapper>) -> Result<bool, String> {
    Ok(state.state.is_preventing_sleep())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_acquire_first_request() {
        let state = KeepAwakeState::new_for_tests();
        assert!(state.acquire().unwrap());
        assert_eq!(state.ref_count(), 1);
    }

    #[test]
    fn test_acquire_multiple_requests() {
        let state = KeepAwakeState::new_for_tests();
        assert!(state.acquire().unwrap()); // First request
        assert!(!state.acquire().unwrap()); // Second request
        assert!(!state.acquire().unwrap()); // Third request
        assert_eq!(state.ref_count(), 3);
    }

    #[test]
    fn test_release_last_request() {
        let state = KeepAwakeState::new_for_tests();
        state.acquire().unwrap();
        state.acquire().unwrap();
        assert!(!state.release().unwrap()); // Release second request
        assert!(state.release().unwrap()); // Release last request
        assert_eq!(state.ref_count(), 0);
    }

    #[test]
    fn test_release_when_empty() {
        let state = KeepAwakeState::new_for_tests();
        // Try to release when no requests exist
        assert!(!state.release().unwrap());
        assert_eq!(state.ref_count(), 0);
    }

    #[test]
    fn test_is_preventing_sleep() {
        let state = KeepAwakeState::new_for_tests();
        assert!(!state.is_preventing_sleep());
        state.acquire().unwrap();
        assert!(state.is_preventing_sleep());
        state.release().unwrap();
        assert!(!state.is_preventing_sleep());
    }

    #[test]
    fn test_concurrent_acquires() {
        use std::sync::Arc;
        let state = Arc::new(KeepAwakeState::new_for_tests());
        let mut handles = vec![];

        for _ in 0..10 {
            let state_clone = Arc::clone(&state);
            let handle = std::thread::spawn(move || {
                state_clone.acquire().unwrap();
                state_clone.ref_count()
            });
            handles.push(handle);
        }

        let counts: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();

        // All acquires should have succeeded
        assert!(counts.iter().all(|&c| c >= 1));
        assert_eq!(state.ref_count(), 10);
    }
}
