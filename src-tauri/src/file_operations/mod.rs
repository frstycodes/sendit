use crate::files::{self};
use crate::state::AppState;
use crate::{events, state::State, utils};
use iroh_blobs::rpc::client::blobs::WrapOption;
use iroh_blobs::{provider::AddProgress, util::SetTagOption};
use n0_future::stream::StreamExt;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

#[derive(Debug, Serialize)]
pub struct ValidatedFile {
    name: String,
    icon: String,
    size: u64,
    path: String,
}

#[tauri::command]
pub async fn validate_files(paths: Vec<String>) -> Result<Vec<ValidatedFile>, String> {
    let mut files = Vec::new();

    let tasks = paths
        .into_iter()
        .map(|path| tokio::spawn(async move { validate_file(&path) }));

    for task in tasks {
        let task = task.await.map_err(|e| format!("Task error: {}", e))?;
        match task {
            Ok(file) => files.push(file),
            Err(e) => error!(e),
        }
    }

    Ok(files)
}

fn validate_file(path: &str) -> Result<ValidatedFile, String> {
    let original_path = path.to_string();

    let path = utils::validate_file_path(path)?;
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
pub async fn add_file(state: State<'_>, path: String, handle: AppHandle) -> Result<(), String> {
    info!("Adding file: {}", path);

    let original_path = path.clone();
    let path = utils::validate_file_path(path)?;
    let file_name = utils::file_name_from_path(&path)?;
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

    let mut hash = iroh_blobs::Hash::EMPTY;
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
                    handle.emit(events::UPLOAD_FILE_ADDED, payload).ok();
                }
                AddProgress::Progress { offset, .. } => {
                    if throttle.is_free() {
                        let progress_percent = (offset as f32 / size as f32) * 100.0;
                        debug!("Progress: {}", progress_percent);
                        let payload = events::UploadFileProgress {
                            path: file_name.clone(),
                            progress: progress_percent,
                        };
                        handle.emit(events::UPLOAD_FILE_PROGRESS, payload).ok();
                    }
                }
                AddProgress::Done { hash: _hash, .. } => {
                    hash = _hash;
                    info!("File uploaded: {}", original_path);
                    let payload = events::UploadFileCompleted {
                        name: file_name.clone(),
                    };
                    handle.emit(events::UPLOAD_FILE_COMPLETED, payload).ok();
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

    let file = files::File {
        name: file_name,
        icon,
        size,
        hash,
    };
    let mut files = state.files().await;
    files.add_file(file);

    Ok(())
}


#[tauri::command]
pub async fn remove_file(path: String, handle: AppHandle) -> Result<(), String> {
    let state = handle.state::<AppState>();

    let path = PathBuf::from(path);
    let name = utils::file_name_from_path(&path)?;
    info!("Removing file : {}", name);

    let hash = {
        let files = state.files().await;
        files
            .get(&name)
            .ok_or_else(|| format!("File not found: {}", name))?
            .hash
    };

    state
        .iroh()
        .blobs
        .delete_blob(hash)
        .await
        .map_err(|e| format!("Failed to delete blob: {}", e))?;

    {
        let mut files = state.files().await;
        files.remove_file(&name);
    }

    handle
        .emit(
            events::UPLOAD_FILE_REMOVED,
            events::UploadFileRemoved {
                name: name.to_owned(),
            },
        )
        .ok();

    Ok(())
}

#[tauri::command]
pub async fn remove_all_files(state: State<'_>, handle: AppHandle) -> Result<(), String> {
    info!("Removing all files");
    let mut files = state.files().await;
    let handle = Arc::new(handle);

    let tasks = files
        .iter()
        .map(|(_, file)| {
            let handle = Arc::clone(&handle);
            let file = file.clone();
            let hash = file.hash;
            tokio::spawn(async move {
                let state = handle.state::<AppState>();
                state
                    .iroh()
                    .blobs
                    .delete_blob(hash)
                    .await
                    .map_err(|e| format!("Failed to delete blob: {}", e))?;

                handle
                    .emit(
                        events::UPLOAD_FILE_REMOVED,
                        events::UploadFileRemoved {
                            name: file.name.clone(),
                        },
                    )
                    .ok();

                info!("File {} removed successfully", hash);
                sleep(Duration::from_secs(2)).await;

                Ok::<(), String>(())
            })
        })
        .collect::<Vec<_>>();

    for task in tasks {
        let result = task.await.map_err(|e| format!("Task error: {}", e))?;
        if let Err(e) = result {
            error!("Error removing file: {}", e);
        }
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
