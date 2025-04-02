#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod events;
mod iroh;
mod utils;

use anyhow::Result;

use iroh::BlobsClient;
use serde::Serialize;
use std::{
    fs,
    path::PathBuf,
    str::FromStr,
    sync::Arc,
    thread,
    time::{Duration, Instant},
};

use tokio::sync::{Mutex, MutexGuard};
use tracing::info;

use iroh_blobs::{
    get::db::DownloadProgress, provider::AddProgress, store::ExportFormat, ticket::BlobTicket,
    BlobFormat, Hash,
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
}

impl AppState {
    fn new(iroh: iroh::Iroh) -> Self {
        Self {
            iroh,
            files: Mutex::new(files::Files::new()),
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

    println!("Exists: {}", data_dir.exists());
    println!("Cleaning up data directory: {:?}", data_dir.display());

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
            Err(e) => println!("Error at path: {}\nError: {}", path, e),
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
        return Err("File does not exist at path".to_string());
    }

    if path.is_dir() {
        return Err("Directory not supported".to_string());
    }

    let icon = utils::get_file_icon(original_path.clone());
    let icon = match icon {
        Ok(icon) => icon,
        Err(e) => {
            println!("{}. Using default value", e);
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
    let original_path = path.clone();
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {:?}", e))?;

    if !path.exists() {
        return Err("File does not exist at path".to_string());
    }

    if path.is_dir() {
        return Err("Directory not supported".to_string());
    }

    let icon = utils::get_file_icon(original_path.clone());
    let icon = match icon {
        Ok(icon) => icon,
        Err(e) => {
            println!("{}. Using default value.", e);
            String::new()
        }
    };
    let file_name = utils::file_name_from_path(&path)?;

    {
        let files = state.files().await;
        if files.has_file(&file_name) {
            return Err(format!("Duplicate file names not allowed.",));
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
                    println!("Found file: {}", file_name);
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
                        println!("Progress: {}", progress_percent);
                        let payload = events::UploadFileProgress {
                            path: file_name.clone(),
                            progress: progress_percent,
                        };
                        let _ = handle.emit(events::UPLOAD_FILE_PROGRESS, payload);
                    }
                }
                AddProgress::Done { hash: _hash, .. } => {
                    hash = _hash;
                    println!("File uploaded: {}", original_path);
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
                println!("Failed to add file: {:?}", e);
            }
        }
    }

    let ticket = BlobTicket::new(state.iroh().node_addr.clone(), hash, BlobFormat::Raw)
        .map_err(|e| format!("Failed to create ticket: {}", e))?;

    println!("Ticket created: {}", ticket);

    {
        let mut files = state.files.lock().await;
        files.add_file(file_name, icon, size, ticket);
    }
    Ok(())
}

#[tauri::command]
async fn remove_file(state: State<'_>, path: String, handle: AppHandle) -> Result<(), String> {
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
    let mut files = state.files().await;
    let file = files
        .get(&name)
        .ok_or_else(|| format!("File not found: {}", name))?;

    let hash = file.ticket.hash();

    state
        .iroh()
        .blobs
        .delete_blob(hash)
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
    let mut files = state.files().await;

    for (_, file) in files.entries() {
        let hash = file.ticket.hash();
        println!("File {} removed successfully", hash);
        state
            .iroh()
            .blobs
            .delete_blob(hash)
            .await
            .map_err(|e| format!("Failed to delete blob: {}", e))?;

        let _ = handle.emit(
            events::UPLOAD_FILE_REMOVED,
            events::UploadFileRemoved(file.name.clone()),
        );

        println!("Blob {} removed successfully", hash);
    }

    files.clear();

    println!("All files removed successfully");

    Ok(())
}

#[tauri::command]
async fn generate_ticket(state: State<'_>) -> Result<String, String> {
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

    Ok(ticket.to_string())
}

#[tauri::command]
async fn download(state: State<'_>, ticket: String, handle: AppHandle) -> Result<(), String> {
    let handle = Arc::new(handle);

    let ticket =
        BlobTicket::from_str(&ticket).map_err(|e| format!("Failed to parse ticket: {}", e))?;

    let blobs = Arc::new(state.iroh().blobs.clone());

    blobs
        .download(ticket.hash(), ticket.node_addr().clone())
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
            continue;
        };

        println!("{:?}", parts);

        let name = parts[0].to_owned();
        let icon = parts[1].to_owned();
        let size: u64 = parts[2]
            .parse()
            .map_err(|e| format!("Failed to parse file size: {}", e))?;
        let ticket: BlobTicket = parts[3]
            .parse()
            .map_err(|e| format!("Failed to parse file ticket: {}", e))?;

        let file = files::File {
            name: name.clone(),
            icon: String::new(), // we don't need icon for download task
            size: size.clone(),
            ticket,
        };

        // Emit event to notify UI about new download
        let payload = events::DownloadFileAdded { name, icon, size };
        let _ = handle.clone().emit(events::DOWNLOAD_FILE_ADDED, payload);

        let blobs = Arc::clone(&blobs);
        let export_dir = Arc::clone(&export_dir);
        let handle = Arc::clone(&handle);

        let task = tokio::spawn(async move {
            let _ = download_file(&blobs, file, &handle, &export_dir).await;
        });

        tasks.push(task);
    }

    for task in tasks {
        task.await.map_err(|e| format!("Task failed: {}", e))?;
    }

    let _ = handle.emit(events::DOWNLOAD_ALL_COMPLETE, ());

    print!("{}", s);

    Ok(())
}

async fn download_file(
    blobs: &BlobsClient,
    file: files::File,
    handle: &AppHandle,
    export_dir: &PathBuf,
) -> Result<(), String> {
    let mut size: u64 = 0;
    use DownloadProgress as DP;
    let mut throttle = utils::Throttle::new(Duration::from_millis(10));
    let ticket = &file.ticket;

    let dest = export_dir.join(file.name.clone());

    if dest.exists() {
        let _ = handle.emit(
            events::DOWNLOAD_FILE_ERROR,
            events::DownloadFileError {
                name: file.name.clone(),
                error: "File already exists".to_string(),
            },
        );
        return Err("File already exists".to_string());
    }

    let mut r = blobs
        .download(ticket.hash(), ticket.node_addr().clone())
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;

    let mut last_offset = 0;
    let mut timestamp = Instant::now();
    let mut aborted_file = "";

    while let Some(progress) = r.next().await {
        if aborted_file == file.name {
            handle.emit(
                events::DOWNLOAD_FILE_ABORTED,
                events::DownloadFileAborted {
                    name: file.name.clone(),
                    reason: "Cancelled.".to_string(),
                },
            );
            return Err("Download aborted".to_string());
        }

        match progress {
            Ok(p) => match p {
                DP::FoundLocal { size: s, .. } => {
                    println!("Found Local: {}", file.name.clone());
                    size = s.value();
                }
                DP::Found { size: s, id, .. } => {
                    println!("Found: {}", id);
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
                    println!("All Done: {}", file.name);
                    let _ = handle.emit(
                        events::DOWNLOAD_FILE_COMPLETED,
                        events::DownloadFileCompleted(file.name.clone()),
                    );
                    break;
                }

                DP::Abort(err) => {
                    println!("Download aborted: {:?}", err);
                }

                e => println!("Unhandled download event: {:?}", e),
            },

            Err(e) => println!("Error: {}", e),
        }
    }

    blobs
        .export(ticket.hash(), dest, ExportFormat::Blob, ExportMode::Copy)
        .await
        .map_err(|e| format!("Error exporting file: {}", e))?
        .finish()
        .await
        .map_err(|e| format!("Error finishing export: {}", e))?;

    println!("Exported file to: {}", file.name);
    Ok(())
}

async fn setup(handle: AppHandle) -> Result<()> {
    let data_dir = handle.path().temp_dir()?.join(DATA_DIR);
    fs::create_dir_all(&data_dir)?;

    let iroh = iroh::Iroh::new(data_dir).await?;
    handle.manage(AppState::new(iroh));

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
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
