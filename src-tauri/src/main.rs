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
use std::{borrow::Cow, fs, path::PathBuf, str::FromStr};
use tracing::info;

use iroh_blobs::{
    export::ExportProgress,
    store::{ExportFormat, ExportMode},
};
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

    let file_name = path
        .file_name()
        .ok_or("Cannot get filename")?
        .to_string_lossy()
        .to_string();

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

    let mut size: u64 = 0;
    type IP = ImportProgress;
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
                    let progress_percent = (offset as f32 / size as f32) * 100.0;
                    println!("Progress: {}", progress_percent);
                    let payload = events::UploadFileProgress {
                        path: original_path.clone(),
                        progress: progress_percent,
                    };
                    let _ = handle.emit(events::UPLOAD_FILE_PROGRESS, payload);
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
    let name = utils::file_name(&path)?;

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

        let mut name = String::from_utf8_lossy(&key).into_owned();
        if name.len() >= 2 {
            name.remove(name.len() - 1);
        }
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

    let doc = state
        .iroh()
        .docs
        .import(ticket.clone())
        .await
        .map_err(|e| format!("Failed to import file: {}", e))?;

    let export_dir = match dirs_next::download_dir() {
        Some(d) => d,
        None => {
            return Err("Download directory not found".into());
        }
    }
    .join("sendit");

    let mut entries = doc
        .get_many(Query::all())
        .await
        .map_err(|e| format!("Failed to get entries: {}", e))?;

    while let Some(entry) = entries.next().await {
        let entry = entry.map_err(|e| format!("Failed to get entry: {}", e))?;

        let mut name = String::from_utf8_lossy(entry.key()).to_string();
        if name.len() >= 2 {
            name.remove(name.len() - 1); // Last character is a Null Byte.
        }

        let mut dest = export_dir.clone().join(name.clone());

        // Keep adding the copy to the destination path until it doesn't exist
        while dest.exists() {
            match dest.extension() {
                Some(ext) => {
                    let ext = ext.to_str().ok_or("Failed to get extension")?;
                    let ext = format!("copy.{}", ext);
                    dest.set_extension(ext);
                }
                None => {
                    let file_name = dest.file_name().ok_or("Failed to get file name")?;
                    let file_name = format!("{}-copy", file_name.to_string_lossy());
                    dest.set_file_name(file_name);
                }
            }
        }
        let name = dest
            .file_name()
            .ok_or("Failed to get file name")?
            .to_string_lossy()
            .to_string();

        let mut r = state
            .doc
            .export_file(entry, dest.clone(), ExportMode::Copy)
            .await
            .map_err(|e| format!("Failed to export file: {}", e))?;

        type EP = ExportProgress;
        let mut size: u64 = 0;
        while let Some(progress) = r.next().await {
            match progress {
                Ok(p) => match p {
                    EP::Found { size: _size, .. } => {
                        size = _size.value();
                        let payload = events::DownloadFileAdded {
                            name: name.clone(),
                            size: _size.value(),
                        };

                        let _ = handle.emit(events::DOWNLOAD_FILE_ADDED, payload);
                    }
                    EP::Progress { offset, .. } => {
                        println!("Progress: {}", offset);
                        let payload = events::DownloadFileProgress {
                            name: name.clone(),
                            progress: (offset as f32 / size as f32) * 100.0,
                        };
                        let _ = handle.emit(events::DOWNLOAD_FILE_PROGRESS, payload);
                    }
                    EP::Done { .. } => {
                        let _ = handle.emit(
                            events::DOWNLOAD_FILE_COMPLETED,
                            events::DownloadFileCompleted(name.clone()),
                        );
                        break;
                    }
                    EP::AllDone => {
                        break;
                    }
                    EP::Abort(..) => {}
                },
                Err(e) => {
                    println!("Error: {}", e);
                }
            }
        }
    }
    Ok(())
}

async fn abort_downlaod(path: String) {}

async fn setup(handle: AppHandle) -> Result<()> {
    // Data directory setup
    let data_dir = handle.path().app_data_dir()?.join(".temp");
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
