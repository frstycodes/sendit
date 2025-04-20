#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod download;
mod events;
mod file_operations;
mod files;
mod iroh;
mod state;
mod theme;
mod ticket;
mod utils;

use log::LevelFilter;
use std::fs;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};
use tracing::{error, info};

const DATA_DIR: &str = "sendit";

async fn setup(handle: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = handle.path().temp_dir()?.join(DATA_DIR);
    println!("Data directory created at: {}", data_dir.display());
    fs::create_dir_all(&data_dir)?;
    info!("Data directory created at: {}", data_dir.display());

    let iroh = iroh::Iroh::new(data_dir).await?;
    handle.manage(state::AppState::new(iroh));

    Ok(())
}

#[tauri::command]
async fn clean_up(state: state::State<'_>, handle: tauri::AppHandle) -> Result<(), String> {
    let data_dir = handle
        .path()
        .temp_dir()
        .map_err(|e| format!("Failed to get temp dir: {:?}", e))?
        .join(DATA_DIR);

    info!("Cleaning up data directory: {:?}", data_dir.display());

    fs::remove_dir_all(data_dir.clone())
        .map_err(|e| format!("Failed to remove data dir: {:?}", e))?;

    state
        .iroh()
        .shutdown()
        .await
        .map_err(|e| format!("Failed to shutdown iroh: {:?}", e))?;

    let iroh = iroh::Iroh::new(data_dir)
        .await
        .map_err(|e| format!("Failed to create iroh instance: {:?}", e))?;

    handle.manage(state::AppState::new(iroh));

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                ])
                .level(LevelFilter::Error)
                .level(LevelFilter::Warn)
                .level(LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_windows_version::init()) // WINDOWS VERSION
        .plugin(tauri_plugin_clipboard_manager::init()) // CLIPBOARD
        .plugin(tauri_plugin_dialog::init()) // DIALOG
        .plugin(tauri_plugin_opener::init()) // FILE OPENER
        .setup(|app| {
            let handle = app.handle().clone();
            let window = handle.get_webview_window("main").unwrap();

            #[cfg(debug_assertions)] // Only on Dev environment
            window.open_devtools();

            #[cfg(target_os = "windows")]
            {
                let res = window_vibrancy::apply_mica(&window, None);
                if let Err(err) = res {
                    error!("Error applying mica: {}", err);
                }
            }

            tauri::async_runtime::spawn(async move {
                if let Err(err) = setup(handle).await {
                    error!("Error setting up application: {}", err);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            clean_up,
            file_operations::add_file,
            file_operations::remove_file,
            file_operations::remove_all_files,
            file_operations::validate_files,
            download::download_header,
            ticket::generate_ticket,
            theme::set_theme,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
