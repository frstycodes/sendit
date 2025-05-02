use log::{error, info, warn};
use n0_future::stream::StreamExt;
use std::str::FromStr;
use std::{collections::HashMap, path::PathBuf, sync::Arc, time::Instant};
use tauri::{AppHandle, Emitter, Listener, Manager};

use crate::state::AppState;
use crate::{events, files, state::State, utils};
use iroh::NodeAddr;
use iroh_blobs::{
    get::db::DownloadProgress,
    store::{ExportFormat, ExportMode},
    ticket::BlobTicket,
};

#[tauri::command]
pub async fn download_header(
    state: State<'_>,
    ticket: String,
    handle: AppHandle,
) -> Result<(), String> {
    info!("Downloading with ticket: {}", ticket);
    let handle = Arc::new(handle);
    let export_dir = Arc::new(utils::get_download_dir(&handle)?);
    let iroh = state.iroh();
    let blobs = &iroh.blobs;

    let ticket =
        BlobTicket::from_str(&ticket).map_err(|e| format!("Failed to parse ticket: {}", e))?;
    let remote_node_addr = ticket.node_addr().clone();

    // Download and read the header file
    let header_content = utils::download_and_read_header(&blobs, ticket).await?;

    let handles = std::sync::Mutex::new(HashMap::new());
    let mut files = files::Files::from_str(header_content.as_str())?;
    let mut tasks = Vec::with_capacity(files.len());

    for (_, file) in files.drain() {
        let payload = events::DownloadFileAdded {
            name: file.name.clone(),
            icon: file.icon.clone(),
            size: file.size.clone(),
        };

        handle.emit(events::DOWNLOAD_FILE_ADDED, payload).ok();

        let export_dir = Arc::clone(&export_dir);
        let handle = Arc::clone(&handle);
        let filename = file.name.clone();
        let remote_node_addr = remote_node_addr.clone();

        // Spawn a new task for each file download
        let task = tokio::spawn(async move {
            let name = file.name.clone();
            let res = download_file(&handle, file, &export_dir, remote_node_addr).await;
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
        let filename = event.payload().replace("\"", ""); // Remove quotes
        if let Ok(mut handles) = handles.lock() {
            if let Some(handle) = handles.remove(&filename) {
                handle.abort();
                let payload = events::DownloadFileAborted {
                    name: filename.clone(),
                    reason: "Cancelled by user".to_string(),
                };
                handle_for_listener
                    .as_ref()
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
        .as_ref()
        .emit(events::DOWNLOAD_ALL_COMPLETE, ())
        .map_err(|e| format!("Failed to emit completion event: {}", e))?;

    // Unlisten to the cancel download event
    handle.as_ref().unlisten(listener);
    Ok(())
}

async fn download_file(
    handle: &AppHandle,
    file: files::File,
    export_dir: &PathBuf,
    remote_node_addr: NodeAddr,
) -> Result<(), String> {
    info!("Started downloading file: {}", file.name);
    let state = handle.state::<AppState>();
    let iroh = state.iroh();
    let blobs = &iroh.blobs;

    let dest = export_dir.join(&file.name);

    // Check if file exists before starting download
    if dest.exists() {
        let err = format!("File already exists");
        handle
            .emit(
                events::DOWNLOAD_FILE_ERROR,
                events::DownloadFileError {
                    name: file.name.clone(),
                    error: err.clone(),
                },
            )
            .ok();
        return Err(err);
    }

    let mut r = blobs
        .download(file.hash, remote_node_addr)
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;

    let mut last_offset = 0;
    let mut timestamp = Instant::now();
    let mut size: u64 = 0;
    let mut throttle = utils::Throttle::new(std::time::Duration::from_millis(100));

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
                    let now = Instant::now();
                    let elapsed = timestamp.elapsed();
                    let speed = if elapsed.as_micros() > 0 {
                        (offset - last_offset) as f32 / elapsed.as_micros() as f32
                    } else {
                        0.0
                    };
                    timestamp = now;
                    last_offset = offset;

                    if size > 0 {
                        let percentage = (offset as f32 / size as f32) * 100.0;
                        let payload = events::DownloadFileProgress {
                            name: file.name.clone(),
                            progress: percentage,
                            speed,
                        };
                        handle.emit(events::DOWNLOAD_FILE_PROGRESS, payload).ok();
                    }
                }

                DP::AllDone(..) => {
                    info!("All Done: {}", file.name);
                    break;
                }

                e => warn!("Unhandled download event: {:?}", e),
            },

            Err(e) => {
                handle
                    .emit(
                        events::DOWNLOAD_FILE_ERROR,
                        events::DownloadFileError {
                            name: file.name.clone(),
                            error: e.to_string(),
                        },
                    )
                    .ok();
                return Err(format!("Error during download: {}", e));
            }
        }
    }
    // Export the downloaded file
    blobs
        .export(
            file.hash,
            dest.clone(),
            ExportFormat::Blob,
            ExportMode::Copy,
        )
        .await
        .map_err(|e| format!("Error exporting file: {}", e))?
        .finish()
        .await
        .map_err(|e| format!("Error finishing export: {}", e))?;

    info!("Exported file to: {}", file.name);

    // Emit completion event
    handle
        .emit(
            events::DOWNLOAD_FILE_COMPLETED,
            events::DownloadFileCompleted {
                name: file.name.clone(),
                path: dest.display().to_string(),
            },
        )
        .ok();

    Ok(())
}
