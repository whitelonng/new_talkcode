// Device ID management module
// Provides secure device identification stored in app data directory

use std::path::Path;
use tauri::Manager;

/// Get or create device ID (stored in app data directory)
///
/// The device ID is a persistent UUID stored in the app data directory.
/// This provides a secure way to identify the device across sessions
/// without relying on client-side storage like localStorage.
pub fn get_or_create_device_id(app_data_dir: &Path) -> String {
    let device_id_path = app_data_dir.join("device_id");

    // Try to read existing device ID
    if let Ok(id) = std::fs::read_to_string(&device_id_path) {
        let id = id.trim().to_string();
        if !id.is_empty() {
            return id;
        }
    }

    // Generate new device ID
    let new_id = uuid::Uuid::new_v4().to_string();

    // Save it
    if let Err(e) = std::fs::write(&device_id_path, &new_id) {
        log::error!("Failed to save device_id: {}", e);
    }

    new_id
}

/// Tauri command to get device ID
/// Exposes device ID functionality to TypeScript
#[tauri::command]
pub fn get_device_id(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    Ok(get_or_create_device_id(&app_data_dir))
}
