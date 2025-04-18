#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod events;
mod iroh;
mod utils;

use iroh::BlobsClient;
use log::LevelFilter;
use serde::Serialize;
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    str::FromStr,
    sync::Arc,
    time::{Duration, Instant},
};
use tauri_plugin_log::{Target, TargetKind};
use utils::LogLevel;
use window_vibrancy::NSVisualEffectMaterial;

use tokio::sync::{Mutex, MutexGuard};
use tracing::{debug, error, info, warn};

use iroh_blobs::{
    get::db::DownloadProgress, provider::AddProgress, store::ExportFormat, ticket::BlobTicket, Hash,
};
use iroh_blobs::{rpc::client::blobs::WrapOption, store::ExportMode, util::SetTagOption};
use n0_future::stream::StreamExt;
use tauri::{AppHandle, Emitter, Listener, Manager};

mod files;

const DATA_DIR: &str = "sendit";

type State<'a> = tauri::State<'a, AppState>;
pub struct AppState {
    iroh: iroh::Iroh,
    files: Mutex<files::Files>,
    header_tickets: Mutex<Vec<BlobTicket>>,
}

impl AppState {
    fn new(iroh: iroh::Iroh) -> Self {
        Self {
            iroh,
            files: Mutex::new(files::Files::new()),
            header_tickets: Mutex::new(Vec::new()),
        }
    }

    fn iroh(&self) -> &iroh::Iroh {
        &self.iroh
    }

    async fn files(&self) -> MutexGuard<'_, files::Files> {
        self.files.lock().await
    }
}

#[tauri::command]
async fn clean_up(state: tauri::State<'_, AppState>, handle: AppHandle) -> Result<(), String> {
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

    handle.manage(AppState::new(iroh));

    Ok(())
}

#[derive(Debug, Serialize)]
struct ValidatedFile {
    name: String,
    icon: String,
    size: u64,
    path: String,
}

#[tauri::command]
fn validate_files(paths: Vec<&str>) -> Result<Vec<ValidatedFile>, String> {
    let mut files = Vec::new();

    for path in paths {
        match validate_file(path) {
            Ok(file) => files.push(file),
            Err(e) => warn!("Error at path: {}\nError: {}", path, e),
        }
    }

    Ok(files)
}

fn validate_file(path: &str) -> Result<ValidatedFile, String> {
    let original_path = path.to_string();
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {:?}", e))?;

    if !path.exists() {
        let err = log!(LogLevel::Error, "File does not exists at path");
        return Err(err);
    }

    if path.is_dir() {
        let err = log!(LogLevel::Error, "Directory not supported");
        return Err(err);
    }

    let icon = utils::get_file_icon(original_path.clone());
    let icon = match icon {
        Ok(icon) => icon,
        Err(e) => {
            warn!("{}. Using default value", e);
            String::new()
        }
    };

    let metadata = path
        .metadata()
        .map_err(|e| format!("Failed to get metadata: {:?}", e))?;

    let size = metadata.len();
    let name = utils::file_name_from_path(&path)?;

    let file = ValidatedFile {
        name,
        icon,
        size,
        path: original_path,
    };

    Ok(file)
}

#[tauri::command]
async fn add_file(state: State<'_>, path: String, handle: AppHandle) -> Result<(), String> {
    info!("Adding file: {}", path);
    let original_path = path.clone();
    let path = utils::validate_file_path(path)?;
    let file_name = utils::file_name_from_path(&path)?;

    // New Block to not freeze the lock unnecessarily
    {
        let files = state.files().await;
        if files.has_file(&file_name) {
            let err = format!("Duplicate file names not allowed.",);
            error!("{}", err);
            return Err(err);
        }
    }

    let icon = utils::get_file_icon(original_path.clone());
    let icon = match icon {
        Ok(i) => i,
        Err(e) => {
            warn!("{}. Using default value.", e);
            String::new()
        }
    };

    let mut r = state
        .iroh()
        .blobs
        .add_from_path(path.clone(), true, SetTagOption::Auto, WrapOption::NoWrap)
        .await
        .map_err(|e| format!("Failed to add file: {:?}", e))?;

    let mut size: u64 = 0;
    let mut throttle = utils::Throttle::new(Duration::from_millis(32));

    let mut hash: Hash = Hash::EMPTY;
    while let Some(progress) = r.next().await {
        match progress {
            Ok(p) => match p {
                AddProgress::Found {
                    size: file_size, ..
                } => {
                    info!("Found file: {}", file_name);
                    size = file_size;

                    let payload = events::UploadFileAdded {
                        name: file_name.clone(),
                        icon: icon.clone(),
                        path: original_path.to_string(),
                        size,
                    };
                    let _ = handle.emit(events::UPLOAD_FILE_ADDED, payload);
                }
                AddProgress::Progress { offset, .. } => {
                    if throttle.is_free() {
                        let progress_percent = (offset as f32 / size as f32) * 100.0;
                        debug!("Progress: {}", progress_percent);
                        let payload = events::UploadFileProgress {
                            path: file_name.clone(),
                            progress: progress_percent,
                        };
                        let _ = handle.emit(events::UPLOAD_FILE_PROGRESS, payload);
                    }
                }
                AddProgress::Done { hash: _hash, .. } => {
                    hash = _hash;
                    info!("File uploaded: {}", original_path);
                    let payload = events::UploadFileCompleted {
                        name: file_name.clone(),
                    };
                    let _ = handle.emit(events::UPLOAD_FILE_COMPLETED, payload);
                }
                AddProgress::Abort { .. } => {
                    info!("Upload aborted: {}", original_path);
                }
                AddProgress::AllDone { .. } => {
                    break;
                }
            },
            Err(e) => {
                error!("Failed to add file: {:?}", e);
            }
        }
    }

    {
        let mut files = state.files.lock().await;
        files.add_file(file_name, icon, size, hash);
    }
    Ok(())
}

#[tauri::command]
async fn remove_file(state: State<'_>, path: String, handle: AppHandle) -> Result<(), String> {
    info!("Removing file: {}", path);
    let path = PathBuf::from(path);
    let name = utils::file_name_from_path(&path)?;

    internal_remove_file(&state, &name, &handle).await?;
    Ok(())
}

async fn internal_remove_file(
    state: &State<'_>,
    name: &str,
    handle: &AppHandle,
) -> Result<(), String> {
    info!("Removing file internally: {}", name);
    let mut files = state.files().await;
    let file = files
        .get(&name)
        .ok_or_else(|| format!("File not found: {}", name))?;

    state
        .iroh()
        .blobs
        .delete_blob(file.hash)
        .await
        .map_err(|e| format!("Failed to delete blob: {}", e))?;

    files.remove_file(&name);
    let _ = handle.emit(
        events::UPLOAD_FILE_REMOVED,
        events::UploadFileRemoved {
            name: name.to_owned(),
        },
    );

    Ok(())
}

#[tauri::command]
async fn remove_all_files(state: State<'_>, handle: AppHandle) -> Result<(), String> {
    info!("Removing all files");
    let mut files = state.files().await;

    for (_, file) in files.entries() {
        state
            .iroh()
            .blobs
            .delete_blob(file.hash)
            .await
            .map_err(|e| format!("Failed to delete blob: {}", e))?;

        let _ = handle.emit(
            events::UPLOAD_FILE_REMOVED,
            events::UploadFileRemoved {
                name: file.name.clone(),
            },
        );

        info!("File {} removed successfully", file.hash);
    }

    // Remove all generated header files
    for ticket in state.header_tickets.lock().await.iter() {
        state
            .iroh()
            .blobs
            .delete_blob(ticket.hash())
            .await
            .map_err(|e| format!("Failed to delete blob: {}", e))?;
        info!("Ticket {} removed successfully", ticket);
    }

    files.clear();

    info!("All files removed successfully");

    Ok(())
}

#[tauri::command]
async fn generate_ticket(state: State<'_>) -> Result<String, String> {
    info!("Generating ticket");
    let files = state.files().await;
    let header_str = files.to_string();

    let res = state
        .iroh()
        .blobs
        .add_bytes(header_str)
        .await
        .map_err(|e| format!("Failed to add header file: {}", e))?;

    let ticket = BlobTicket::new(state.iroh().node_addr.clone(), res.hash, res.format)
        .map_err(|e| format!("Failed to create ticket: {}", e))?;

    let mut tickets = state.header_tickets.lock().await;
    tickets.push(ticket.clone());

    Ok(ticket.to_string())
}

#[tauri::command]
async fn download_header(
    state: State<'_>,
    ticket: String,
    handle: AppHandle,
) -> Result<(), String> {
    info!("Downloading with ticket: {}", ticket);
    let handle = Arc::new(handle);

    let ticket =
        BlobTicket::from_str(&ticket).map_err(|e| format!("Failed to parse ticket: {}", e))?;

    let blobs = &state.iroh().blobs;
    let export_dir = Arc::new(utils::get_download_dir(&handle)?);

    // Download and read the header file
    let header_content = utils::download_and_read_header(blobs, ticket).await?;

    let handles = std::sync::Mutex::new(HashMap::new());
    let mut tasks = Vec::new();

    for (_, file) in files::Files::from(header_content).drain() {
        let payload = events::DownloadFileAdded {
            name: file.name.clone(),
            icon: file.icon.clone(),
            size: file.size.clone(),
        };
        handle.emit(events::DOWNLOAD_FILE_ADDED, payload).ok();

        let export_dir = Arc::clone(&export_dir);
        let handle = Arc::clone(&handle);
        let filename = file.name.clone();

        // Spawn a new task for each file download
        let task = tokio::spawn(async move {
            let name = file.name.clone();
            let res = download_file(&handle, file, &export_dir).await;
            if let Err(error) = res {
                error!("Failed to download file: {}", error);
                let payload = events::DownloadFileError { name, error };
                handle.emit(events::DOWNLOAD_FILE_ERROR, payload).ok();
            };
        });

        // Store the abort handler for the task in a map
        let handle = task.abort_handle();
        handles
            .lock()
            .map_err(|e| format!("Failed to lock handles: {}", e))?
            .insert(filename, handle);

        tasks.push(task);
    }

    // Listen for cancel download events
    let handle_for_listener = Arc::clone(&handle);
    let listener = handle.listen(events::CANCEL_DOWNLOAD, move |event| {
        let filename = event.payload().replace("\"", "");
        println!("Removing file: {}", filename);
        if let Ok(mut handles) = handles.lock() {
            if let Some(handle) = handles.remove(&filename) {
                handle.abort();
                let payload = events::DownloadFileAborted {
                    name: filename.clone(),
                    reason: "Cancelled by user".to_string(),
                };
                handle_for_listener
                    .emit(events::DOWNLOAD_FILE_ABORTED, payload.clone())
                    .ok();
                info!("Download cancelled for file: {}", filename);
            }
        }
    });

    // Wait for all tasks to complete
    for task in tasks {
        if let Err(err) = task.await {
            error!("Failed to await task: {}", err);
        }
    }

    // Emit downloads completion event
    handle
        .emit(events::DOWNLOAD_ALL_COMPLETE, ())
        .map_err(|e| format!("Failed to emit completion event: {}", e))?;

    // Unlisten to the cancel download event
    handle.unlisten(listener);
    Ok(())
}

async fn download_file(
    handle: &AppHandle,
    file: files::File,
    export_dir: &PathBuf,
) -> Result<(), String> {
    info!("Started downloading file: {}", file.name);
    let state = handle.state::<AppState>();
    let iroh = state.iroh();
    let node_addr = iroh.node_addr.clone();
    let dest = export_dir.join(&file.name);

    // Check if file exists before starting download
    if dest.exists() {
        let err = log!(LogLevel::Error, "File already exists");
        let _ = handle.emit(
            events::DOWNLOAD_FILE_ERROR,
            events::DownloadFileError {
                name: file.name.clone(),
                error: err.clone(),
            },
        );
        return Err(err);
    }

    let mut r = iroh
        .blobs
        .download(file.hash, node_addr)
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;

    let mut last_offset = 0;
    let mut timestamp = Instant::now();
    let mut size: u64 = 0;
    let mut throttle = utils::Throttle::new(Duration::from_millis(100)); // Reduced UI update frequency

    use DownloadProgress as DP;
    while let Some(progress) = r.next().await {
        match progress {
            Ok(p) => match p {
                DP::FoundLocal { size: s, .. } => {
                    info!("Found Local: {}", file.name);
                    size = s.value();
                }

                DP::Found { size: s, id, .. } => {
                    info!("Found: {}", id);
                    size = s;
                }

                DP::Progress { offset, .. } if throttle.is_free() => {
                    // Only update UI at throttled intervals to improve performance
                    let now = Instant::now();
                    let elapsed = timestamp.elapsed();
                    let speed = if elapsed.as_micros() > 0 {
                        (offset - last_offset) as f32 / elapsed.as_micros() as f32
                    } else {
                        0.0
                    };
                    timestamp = now;
                    last_offset = offset;

                    // Calculate progress percentage and emit event
                    if size > 0 {
                        let percentage = (offset as f32 / size as f32) * 100.0;
                        let payload = events::DownloadFileProgress {
                            name: file.name.clone(),
                            progress: percentage,
                            speed,
                        };
                        let _ = handle.emit(events::DOWNLOAD_FILE_PROGRESS, payload);
                    }
                }

                DP::AllDone(..) => {
                    info!("All Done: {}", file.name);
                    break;
                }

                e => warn!("Unhandled download event: {:?}", e),
            },

            Err(e) => {
                let _ = handle.emit(
                    events::DOWNLOAD_FILE_ERROR,
                    events::DownloadFileError {
                        name: file.name.clone(),
                        error: e.to_string(),
                    },
                );
                return Err(format!("Error during download: {}", e));
            }
        }
    }

    // Export the downloaded file
    iroh.blobs
        .export(file.hash, dest, ExportFormat::Blob, ExportMode::Copy)
        .await
        .map_err(|e| format!("Error exporting file: {}", e))?
        .finish()
        .await
        .map_err(|e| format!("Error finishing export: {}", e))?;

    info!("Exported file to: {}", file.name);

    // Emit completion event
    let _ = handle.emit(
        events::DOWNLOAD_FILE_COMPLETED,
        events::DownloadFileCompleted {
            name: file.name.clone(),
        },
    );

    Ok(())
}

async fn setup(handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = handle.path().temp_dir()?.join(DATA_DIR);
    fs::create_dir_all(&data_dir)?;
    log::info!("Data directory created at: {}", data_dir.display());

    let iroh = iroh::Iroh::new(data_dir).await?;
    handle.manage(AppState::new(iroh));

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
                .build(),
        )
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
                println!("Mica applied");
                if let Err(err) = res {
                    error!("Error applying mica: {}", err);
                }
            }

            #[cfg(target_os = "macos")]
            {
                let res = window_vibrancy::apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::AppearanceBased,
                    None,
                    None,
                );
                if let Err(res) = res {
                    error!("Error applying vibrancy: {}", res);
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
            add_file,
            remove_file,
            remove_all_files,
            validate_files,
            download_header,
            generate_ticket,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
