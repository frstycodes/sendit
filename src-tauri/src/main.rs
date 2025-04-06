#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod events;
mod iroh;
mod utils;

use anyhow::Result;

use ::iroh::NodeAddr;
use iroh::BlobsClient;
use serde::Serialize;
use std::{
    fs,
    path::PathBuf,
    str::FromStr,
    sync::Arc,
    time::{Duration, Instant},
};
use tauri_plugin_log::{Target, TargetKind};
use utils::LogLevel;

use tokio::sync::{Mutex, MutexGuard};
use tracing::{debug, error, info, warn};

use iroh_blobs::{
    get::db::DownloadProgress, provider::AddProgress, store::ExportFormat, ticket::BlobTicket, Hash,
};
use iroh_blobs::{rpc::client::blobs::WrapOption, store::ExportMode, util::SetTagOption};
use n0_future::stream::StreamExt;
use tauri::{AppHandle, Emitter, Manager};

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
async fn clean_up(
    state: tauri::State<'_, AppState>,
    handle: AppHandle,
) -> anyhow::Result<(), String> {
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
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {:?}", e))?;

    if !path.exists() {
        let err = log!(LogLevel::Error, "File does not exist at path");
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
            warn!("{}. Using default value.", e);
            String::new()
        }
    };
    let file_name = utils::file_name_from_path(&path)?;

    {
        let files = state.files().await;
        if files.has_file(&file_name) {
            let err = format!("Duplicate file names not allowed.",);
            error!("{}", err);
            return Err(err);
        }
    }

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
                    let payload = events::UploadFileCompleted(file_name.clone());
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
        events::UploadFileRemoved(name.to_owned()),
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
            events::UploadFileRemoved(file.name.clone()),
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
async fn download(state: State<'_>, ticket: String, handle: AppHandle) -> Result<(), String> {
    info!("Downloading with ticket: {}", ticket);
    let handle = Arc::new(handle);

    let ticket =
        BlobTicket::from_str(&ticket).map_err(|e| format!("Failed to parse ticket: {}", e))?;

    let node_addr = ticket.node_addr().clone();
    let blobs = Arc::new(state.iroh().blobs.clone());

    blobs
        .download(ticket.hash(), node_addr.clone())
        .await
        .map_err(|e| format!("Failed to download header file: {}", e))?
        .finish()
        .await
        .map_err(|e| format!("Failed to finish downloading header file: {}", e))?;

    let bytes = blobs
        .read_to_bytes(ticket.hash())
        .await
        .map_err(|e| format!("Failed to read bytes: {}", e))?;

    let s = String::from_utf8(bytes.to_vec())
        .map_err(|e| format!("Failed to convert bytes to string: {}", e))?;

    let mut tasks = Vec::new();
    let export_dir = Arc::new(utils::get_download_dir(&handle)?);

    let lines = s.lines();

    for line in lines {
        let parts: Vec<&str> = line.split("\0").collect();

        if parts.len() != 4 {
            warn!("Skipping line with invalid number of parts: {:?}", parts);
            continue;
        };

        debug!("{:?}", parts);

        let name = parts[0].to_owned();
        let icon = parts[1].to_owned();
        let size: u64 = parts[2]
            .parse()
            .map_err(|e| format!("Failed to parse file size: {}", e))?;
        let hash: iroh_blobs::Hash = parts[3]
            .parse()
            .map_err(|e| format!("Failed to parse file ticket: {}", e))?;

        let file = files::File {
            name: name.clone(),
            icon: String::new(), // we don't need icon for download task
            size: size.clone(),
            hash,
        };

        // Emit event to notify UI about new download
        let payload = events::DownloadFileAdded { name, icon, size };
        let _ = handle.clone().emit(events::DOWNLOAD_FILE_ADDED, payload);

        let blobs = Arc::clone(&blobs);
        let node_addr = node_addr.clone();
        let export_dir = Arc::clone(&export_dir);
        let handle = Arc::clone(&handle);

        let task = tokio::spawn(async move {
            let _ = download_file(&blobs, node_addr, file, &export_dir, &handle).await;
        });

        tasks.push(task);
    }

    for task in tasks {
        task.await.map_err(|e| format!("Task failed: {}", e))?;
    }

    let _ = handle.emit(events::DOWNLOAD_ALL_COMPLETE, ());

    debug!("{}", s);

    Ok(())
}

async fn download_file(
    blobs: &BlobsClient,
    node_addr: NodeAddr,
    file: files::File,
    export_dir: &PathBuf,
    handle: &AppHandle,
) -> Result<(), String> {
    info!("Downloading file: {}", file.name);
    let mut size: u64 = 0;
    use DownloadProgress as DP;
    let mut throttle = utils::Throttle::new(Duration::from_millis(10));

    let dest = export_dir.join(file.name.clone());

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

    let mut r = blobs
        .download(file.hash, node_addr)
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;

    let mut last_offset = 0;
    let mut timestamp = Instant::now();

    while let Some(progress) = r.next().await {
        match progress {
            Ok(p) => match p {
                DP::FoundLocal { size: s, .. } => {
                    info!("Found Local: {}", file.name.clone());
                    size = s.value();
                }
                DP::Found { size: s, id, .. } => {
                    info!("Found: {}", id);
                    size = s;
                }
                DP::Progress { offset, .. } => {
                    if throttle.is_free() {
                        let speed =
                            (offset - last_offset) as f32 / timestamp.elapsed().as_micros() as f32;

                        timestamp = Instant::now();
                        last_offset = offset;

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
                    let _ = handle.emit(
                        events::DOWNLOAD_FILE_COMPLETED,
                        events::DownloadFileCompleted(file.name.clone()),
                    );
                    break;
                }

                DP::Abort(err) => {
                    error!("Download aborted: {:?}", err);
                }

                e => warn!("Unhandled download event: {:?}", e),
            },

            Err(e) => error!("Error: {}", e),
        }
    }

    blobs
        .export(file.hash, dest, ExportFormat::Blob, ExportMode::Copy)
        .await
        .map_err(|e| format!("Error exporting file: {}", e))?
        .finish()
        .await
        .map_err(|e| format!("Error finishing export: {}", e))?;

    info!("Exported file to: {}", file.name);
    Ok(())
}

async fn setup(handle: AppHandle) -> Result<()> {
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
                    Target::new(TargetKind::Webview),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init()) // CLIPBOARD
        .plugin(tauri_plugin_dialog::init()) // DIALOG
        .plugin(tauri_plugin_opener::init()) // FILE OPENER
        .setup(|app| {
            let handle = app.handle().clone();
            #[cfg(debug_assertions)] // Only on Dev environment
            {
                let window = handle.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            tauri::async_runtime::spawn(async move {
                if let Err(err) = setup(handle).await {
                    eprintln!("Error setting up application: {}", err);
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
            download,
            generate_ticket,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
