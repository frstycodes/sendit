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
use state::user_data::{self, User};
use std::{fs, time::Duration};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_log::{Target, TargetKind};
use tokio::time;
use tracing::{error, info};

const DATA_DIR: &str = ".sendit";
#[cfg(debug_assertions)]
const DATA_DIR_DEBUG: &str = ".sendit-test";

async fn setup(handle: tauri::AppHandle) -> anyhow::Result<()> {
    let download_dir = handle.path().download_dir()?.join("sendit");

    let data_dir = download_dir.join(DATA_DIR);
    fs::create_dir_all(&data_dir)?;
    info!("Data directory created at: {}", data_dir.display());

    let mut iroh = iroh::Iroh::new(data_dir).await?;
    let channel = &mut iroh.gossip.channel_mut();
    #[allow(unused)]
    let rx = channel.take_receiver()?;

    #[cfg(debug_assertions)]
    let iroh_debug = {
        let data_dir = download_dir.join(DATA_DIR_DEBUG);
        fs::create_dir_all(&data_dir)?;
        info!(
            "Data directory for debug created at: {}",
            data_dir.display()
        );

        iroh::Iroh::new(data_dir).await?
    };

    let cfg_path = utils::get_config_dir(&handle)
        .map_err(|e| anyhow::anyhow!(e))?
        .join(user_data::CONFIG_FILE_NAME);

    let user = User::from_config(cfg_path).ok();
    handle.manage(state::AppState::new(user, iroh, iroh_debug));

    Ok(())
}

pub fn notify_app_loaded(handle: AppHandle) {
    tokio::spawn(async move {
        time::sleep(Duration::from_millis(300)).await;
        handle.emit(events::APP_LOADED, ()).ok();
    });
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets(vec![
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

            let handle_clone = handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(err) = setup(handle_clone).await {
                    error!("Error setting up application: {}", err);
                    return;
                } else {
                    notify_app_loaded(handle);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            file_operations::add_file,
            file_operations::remove_file,
            file_operations::remove_all_files,
            file_operations::validate_files,
            download::download_header,
            ticket::generate_ticket,
            theme::set_theme,
            state::get_user,
            state::update_user,
            state::user_data::is_onboarded,
            state::app_loaded
        ])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
