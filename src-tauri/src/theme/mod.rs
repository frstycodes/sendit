use tauri::{AppHandle, Manager};

#[tauri::command]
#[allow(unused)]
pub fn set_theme(theme: String, handle: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let window = handle
            .get_webview_window("main")
            .ok_or_else(|| "Failed to get window")?;

        let res = match theme.as_str() {
            "dark" => window_vibrancy::apply_mica(&window, Some(true)),
            "light" => window_vibrancy::apply_mica(&window, Some(false)),
            _ => window_vibrancy::apply_mica(&window, None),
        };

        if let Err(err) = res {
            tracing::error!("Error setting theme: {}", err);
        }
    }
    Ok(())
}
