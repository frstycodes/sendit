use crate::files;
use crate::iroh;
use iroh_blobs::ticket::BlobTicket;
use tokio::sync::{Mutex, MutexGuard};

pub struct AppState {
    pub(crate) iroh: iroh::Iroh,
    pub(crate) files: Mutex<files::Files>,
    pub(crate) header_tickets: Mutex<Vec<BlobTicket>>,
}

impl AppState {
    pub fn new(iroh: iroh::Iroh) -> Self {
        Self {
            iroh,
            files: Mutex::new(files::Files::new()),
            header_tickets: Mutex::new(Vec::new()),
        }
    }

    pub fn iroh(&self) -> &iroh::Iroh {
        &self.iroh
    }

    pub async fn files(&self) -> MutexGuard<'_, files::Files> {
        self.files.lock().await
    }
}

pub type State<'a> = tauri::State<'a, AppState>;