#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod events;
mod iroh;
mod utils;

use anyhow::Result;

use iroh_docs::{
    rpc::{
        client::docs::{Doc, ImportProgress, ShareMode},
        AddrInfoOptions,
    },
    store::Query,
    AuthorId, DocTicket,
};
use std::{fs, path::PathBuf, str::FromStr, sync::Arc, time::Duration};
use tracing::info;

use iroh_blobs::get::db::DownloadProgress;
use iroh_blobs::store::ExportMode;
use n0_future::stream::StreamExt;
use quic_rpc::transport::flume::FlumeConnector;
use tauri::{AppHandle, Emitter, Manager};

type StateDoc =
    Doc<FlumeConnector<iroh_docs::rpc::proto::Response, iroh_docs::rpc::proto::Request>>;

type State<'a> = tauri::State<'a, AppState>;
pub struct AppState {
    iroh: iroh::Iroh,
    author: AuthorId,
    doc: StateDoc,
}

impl AppState {
    fn new(iroh: iroh::Iroh, author: AuthorId, doc: StateDoc) -> Self {
        Self { iroh, author, doc }
    }

    fn iroh(&self) -> &iroh::Iroh {
        &self.iroh
    }
}

#[tauri::command]
async fn add_file(
    state: tauri::State<'_, AppState>,
    path: String,
    handle: AppHandle,
) -> anyhow::Result<(), String> {
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

    let file_name = utils::file_name_from_path(&path)?;

    let key = iroh_blobs::util::fs::path_to_key(file_name.clone(), None, None)
        .map_err(|e| format!("Failed to generate key: {:?}", e))?;

    let possible_entry = state
        .doc
        .get_exact(state.author.clone(), key.clone(), false)
        .await
        .map_err(|e| format!("Failed to get exact entry: {:?}", e))?;

    if possible_entry.is_some() {
        return Err(format!("Duplicate file names not allowed.",));
    }

    let mut r = state
        .doc
        .import_file(state.author, key, &path, true)
        .await
        .map_err(|e| format!("Failed to import file: {:?}", e))?;

    use ImportProgress as IP;
    let mut size: u64 = 0;
    let mut debouncer = utils::Debouncer::new(Duration::from_millis(32));

    while let Some(progress) = r.next().await {
        match progress {
            Ok(p) => match p {
                IP::Found {
                    size: file_size, ..
                } => {
                    println!("Started uploading file");
                    size = file_size;
                    let payload = events::UploadFileAdded {
                        name: file_name.clone(),
                        path: original_path.clone(),
                        size,
                    };
                    let _ = handle.emit(events::UPLOAD_FILE_ADDED, payload);
                }
                IP::Progress { offset, .. } => {
                    if debouncer.is_free() {
                        let progress_percent = (offset as f32 / size as f32) * 100.0;
                        println!("Progress: {}", progress_percent);
                        let payload = events::UploadFileProgress {
                            path: file_name.clone(),
                            progress: progress_percent,
                        };
                        let _ = handle.emit(events::UPLOAD_FILE_PROGRESS, payload);
                    }
                }
                IP::IngestDone { .. } => {
                    println!("File uploaded: {}", original_path);
                    let payload = events::UploadFileCompleted(file_name.clone());
                    let _ = handle.emit(events::UPLOAD_FILE_COMPLETED, payload);
                }
                IP::Abort { .. } => {
                    info!("Upload aborted: {}", original_path);
                }
                IP::AllDone { .. } => {
                    break;
                }
            },
            Err(e) => {
                println!("Failed to add file: {:?}", e);
            }
        }
    }
    Ok(())
}
#[tauri::command]
async fn remove_file(state: State<'_>, path: String, handle: AppHandle) -> Result<(), String> {
    let path = PathBuf::from(path);
    let name = utils::file_name_from_path(&path)?;

    let key = iroh_blobs::util::fs::path_to_key(name.clone(), None, None)
        .map_err(|e| format!("Failed to generate key: {}", e))?;

    let _deleted = state
        .doc
        .del(state.author, key)
        .await
        .map_err(|e| format!("Failed to delete file: {}", e))?;

    let _ = handle.emit(events::UPLOAD_FILE_REMOVED, events::UploadFileRemoved(name));

    Ok(())
}

#[tauri::command]
async fn remove_all_files(state: State<'_>, handle: AppHandle) -> Result<(), String> {
    let mut entries = state
        .doc
        .get_many(Query::all())
        .await
        .map_err(|e| format!("Failed to get documents: {:?}", e))?;

    while let Some(entry) = entries.next().await {
        let entry = entry.map_err(|e| format!("Failed to get entry: {:?}", e))?;
        let key = entry.key().to_vec();
        state
            .doc
            .del(state.author, key.clone())
            .await
            .map_err(|e| format!("Failed to delete entry: {:?}", e))?;

        let name = utils::file_name_from_key(&key);
        let _ = handle.emit(events::UPLOAD_FILE_REMOVED, events::UploadFileRemoved(name));
    }
    Ok(())
}

#[tauri::command]
async fn generate_ticket(state: State<'_>) -> Result<String, String> {
    let ticket = state
        .doc
        .share(ShareMode::Read, AddrInfoOptions::default())
        .await
        .map_err(|e| format!("Failed to generate ticket: {}", e))?;
    Ok(ticket.to_string())
}

#[tauri::command]
async fn download_file(state: State<'_>, ticket: String, handle: AppHandle) -> Result<(), String> {
    let ticket =
        DocTicket::from_str(&ticket).map_err(|e| format!("Failed to parse ticket: {}", e))?;

    let doc = Arc::new(
        state
            .iroh()
            .docs
            .import(ticket.clone())
            .await
            .map_err(|e| format!("Failed to import file: {}", e))?,
    );

    let export_dir = utils::get_download_dir(&handle)?;

    let mut entries = doc
        .get_many(Query::all())
        .await
        .map_err(|e| format!("Failed to get entries: {}", e))?;

    // Create a vector to hold download tasks
    let mut download_tasks = Vec::new();

    let iroh = Arc::new(state.iroh().to_owned());
    let handle = Arc::new(handle);
    let nodes = Arc::new(ticket.nodes);

    while let Some(entry) = entries.next().await {
        let entry = entry.map_err(|e| format!("Failed to get entry: {}", e))?;

        // Clone Arc references
        let iroh = Arc::clone(&iroh);
        let doc = Arc::clone(&doc);
        let handle = Arc::clone(&handle);
        let nodes = Arc::clone(&nodes);
        // let handle = handle.clone();

        let export_dir = export_dir.clone();

        // Spawn a task for each file download
        let task = tokio::spawn(async move {
            let name = utils::file_name_from_key(entry.key());
            let mut dest = export_dir.clone().join(name.clone());
            println!("Exporting {}", dest.display());

            while dest.exists() {
                match dest.extension() {
                    Some(ext) => {
                        let ext = ext.to_str().ok_or("Failed to get extension")?;
                        dest.set_extension(format!("copy.{}", ext));
                    }
                    None => {
                        let file_name = utils::file_name_from_path(&dest)?;
                        dest.set_file_name(format!("{}-copy", file_name));
                    }
                }
            }

            let name = utils::file_name_from_path(&dest)?;

            let mut r = iroh
                .blobs
                .download(entry.content_hash(), nodes[0].clone())
                .await
                .map_err(|e| format!("Failed to download file: {}", e))?;

            let mut size: u64 = 0;
            use DownloadProgress as DP;
            let mut debouncer = utils::Debouncer::new(Duration::from_millis(10));

            while let Some(progress) = r.next().await {
                match progress {
                    Ok(p) => match p {
                        DP::FoundLocal { size: s, .. } => {
                            println!("Found Local: {}", name);
                            size = s.value();
                            let payload = events::DownloadFileAdded {
                                name: name.clone(),
                                size: size.clone(),
                            };

                            let _ = handle.emit(events::DOWNLOAD_FILE_ADDED, payload);
                        }
                        DP::Found { size: s, id, .. } => {
                            println!("Found: {}", id);
                            size = s;
                            let payload = events::DownloadFileAdded {
                                name: name.clone(),
                                size: size.clone(),
                            };

                            let _ = handle.emit(events::DOWNLOAD_FILE_ADDED, payload);
                        }
                        DP::Progress { offset, .. } => {
                            if debouncer.is_free() {
                                let percentage = (offset as f32 / size as f32) * 100.0;
                                let payload = events::DownloadFileProgress {
                                    name: name.clone(),
                                    progress: percentage,
                                };
                                let _ = handle.emit(events::DOWNLOAD_FILE_PROGRESS, payload);
                            }
                        }
                        DP::AllDone { .. } => {
                            println!("All Done: {}", name);
                            let _ = handle.emit(
                                events::DOWNLOAD_FILE_COMPLETED,
                                events::DownloadFileCompleted(name.clone()),
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

            let out = doc
                .export_file(entry, dest, ExportMode::Copy)
                .await
                .map_err(|e| format!("Error exporting file: {}", e))?
                .finish()
                .await
                .map_err(|e| format!("Error finishing export: {}", e))?;

            println!("Path: {}, size: {}", out.path.display(), out.size);

            Ok::<(), String>(())
        });

        download_tasks.push(task);
    }

    // Wait for all download tasks to complete
    for task in download_tasks {
        let _ = task
            .await
            .map_err(|e| format!("Download task failed: {}", e))?;
    }

    println!("Download finished");
    let _ = handle.emit(events::DOWNLOAD_ALL_COMPLETE, ());
    Ok(())
}

async fn setup(handle: AppHandle) -> Result<()> {
    let data_dir = handle.path().temp_dir()?.join(".sendit");

    fs::create_dir_all(&data_dir)?;

    // Initialize Iroh
    let iroh = iroh::Iroh::new(data_dir).await?;

    let author = iroh.docs.authors().create().await?;
    let doc = iroh.docs.create().await?;

    handle.manage(AppState::new(iroh, author, doc));

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
            add_file,
            remove_file,
            remove_all_files,
            generate_ticket,
            download_file,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}
