use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// Shared state to track whether the app should minimize to tray on close.
/// Updated from the frontend via `set_close_to_tray` command.
pub struct TrayState {
    pub close_to_tray: AtomicBool,
    pub force_exit_on_close: AtomicBool,
    pub active_task_count: AtomicUsize,
    pub tray_icon: Mutex<Option<TrayIcon>>,
}

impl TrayState {
    pub fn new() -> Self {
        Self {
            close_to_tray: AtomicBool::new(true),
            force_exit_on_close: AtomicBool::new(false),
            active_task_count: AtomicUsize::new(0),
            tray_icon: Mutex::new(None),
        }
    }

    pub fn should_close_to_tray(&self) -> bool {
        self.close_to_tray.load(Ordering::Relaxed)
    }

    pub fn set_close_to_tray(&self, enabled: bool) {
        self.close_to_tray.store(enabled, Ordering::Relaxed);
    }

    pub fn should_force_exit_on_close(&self) -> bool {
        self.force_exit_on_close.load(Ordering::Relaxed)
    }

    pub fn set_force_exit_on_close(&self, enabled: bool) {
        self.force_exit_on_close.store(enabled, Ordering::Relaxed);
    }

    pub fn active_task_count(&self) -> usize {
        self.active_task_count.load(Ordering::Relaxed)
    }

    pub fn set_active_task_count(&self, count: usize) {
        self.active_task_count.store(count, Ordering::Relaxed);
    }
}

/// Set up the system tray icon with a context menu.
///
/// The tray icon provides:
/// - Left-click: toggle window visibility
/// - Right-click context menu: Show Window / Quit
pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    // Use the app's default window icon for the tray
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("App must have a default window icon configured in tauri.conf.json");

    let app_handle = app.clone();

    let tray_icon = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("TalkCody")
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "show" => {
                    show_main_window(app);
                }
                "quit" => {
                    log::info!("Tray menu: Quit selected");
                    if let Some(state) = app.try_state::<Arc<TrayState>>() {
                        state.set_force_exit_on_close(true);
                    }

                    if let Some(window) = app.get_webview_window("main") {
                        if let Err(e) = window.close() {
                            log::error!("Failed to close main window from tray quit: {}", e);
                            app.exit(0);
                        }
                    } else {
                        app.exit(0);
                    }
                }
                _ => {}
            }
        })
        .on_tray_icon_event({
            let app_handle = app_handle.clone();
            move |_tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    toggle_main_window(&app_handle);
                }
            }
        })
        .build(app)?;

    if let Some(state) = app.try_state::<Arc<TrayState>>() {
        match state.tray_icon.lock() {
            Ok(mut tray_icon_guard) => {
                *tray_icon_guard = Some(tray_icon);
            }
            Err(e) => {
                log::error!("Failed to persist tray icon state: {}", e);
            }
        }
    } else {
        log::warn!("TrayState missing during tray initialization; tray icon will not be persisted");
    }

    log::info!("System tray initialized successfully");
    Ok(())
}

/// Toggle the visibility of the main window.
fn toggle_main_window<R: tauri::Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                if let Err(e) = window.hide() {
                    log::error!("Failed to hide main window: {}", e);
                }
            }
            Ok(false) => {
                show_main_window(app);
            }
            Err(e) => {
                log::error!("Failed to check window visibility: {}", e);
            }
        }
    }
}

/// Show and focus the main window (cross-platform).
pub fn show_main_window<R: tauri::Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(e) = window.show() {
            log::warn!("Failed to show main window: {}", e);
        }
        if let Err(e) = window.unminimize() {
            log::warn!("Failed to unminimize main window: {}", e);
        }
        if let Err(e) = window.set_focus() {
            log::warn!("Failed to focus main window: {}", e);
        }

        // macOS: bring app to foreground
        #[cfg(target_os = "macos")]
        {
            use cocoa::appkit::NSApplication;
            unsafe {
                let app = cocoa::appkit::NSApp();
                app.activateIgnoringOtherApps_(cocoa::base::YES);
            }
        }

        log::info!("Main window shown and focused");
    } else {
        log::warn!("Main window not found when trying to show");
    }
}

/// Tauri command: update the close-to-tray setting from the frontend.
#[tauri::command]
pub fn set_close_to_tray(enabled: bool, state: tauri::State<Arc<TrayState>>) {
    log::info!("Setting close_to_tray to: {}", enabled);
    state.set_close_to_tray(enabled);
}

/// Tauri command: get the current close-to-tray setting.
#[tauri::command]
pub fn get_close_to_tray(state: tauri::State<Arc<TrayState>>) -> bool {
    state.should_close_to_tray()
}

/// Tauri command: allow the next main-window close event to bypass tray/minimize behavior.
#[tauri::command]
pub fn set_force_exit_on_close(enabled: bool, state: tauri::State<Arc<TrayState>>) {
    log::info!("Setting force_exit_on_close to: {}", enabled);
    state.set_force_exit_on_close(enabled);
}

/// Tauri command: sync the current number of active/running tasks from the frontend.
#[tauri::command]
pub fn set_active_task_count(count: usize, state: tauri::State<Arc<TrayState>>) {
    log::debug!("Setting active_task_count to: {}", count);
    state.set_active_task_count(count);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_state_default() {
        let state = TrayState::new();
        assert!(state.should_close_to_tray());
    }

    #[test]
    fn test_tray_state_set() {
        let state = TrayState::new();
        state.set_close_to_tray(false);
        assert!(!state.should_close_to_tray());
        state.set_close_to_tray(true);
        assert!(state.should_close_to_tray());

        state.set_force_exit_on_close(true);
        assert!(state.should_force_exit_on_close());
        state.set_force_exit_on_close(false);
        assert!(!state.should_force_exit_on_close());

        state.set_active_task_count(3);
        assert_eq!(state.active_task_count(), 3);
        state.set_active_task_count(0);
        assert_eq!(state.active_task_count(), 0);
    }

    #[test]
    fn test_tray_state_thread_safety() {
        use std::thread;

        let state = Arc::new(TrayState::new());

        let handles: Vec<_> = (0..10)
            .map(|i| {
                let state = state.clone();
                thread::spawn(move || {
                    state.set_close_to_tray(i % 2 == 0);
                    state.should_close_to_tray()
                })
            })
            .collect();

        for handle in handles {
            let _ = handle.join().unwrap();
        }
        // Should not panic — atomic operations are always safe
    }
}
