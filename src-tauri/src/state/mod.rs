use crate::files;
use crate::iroh;
use iroh_blobs::ticket::BlobTicket;
use tokio::sync::{Mutex, MutexGuard};

#[derive(Debug)]
pub struct AppState {
    #[allow(unused)]
    #[cfg(debug_assertions)]
    pub(crate) iroh_debug: iroh::Iroh,

    pub(crate) iroh: iroh::Iroh,
    pub(crate) files: Mutex<files::Files>,
    pub(crate) header_tickets: Mutex<Vec<BlobTicket>>,
}

impl AppState {
    pub fn new(iroh: iroh::Iroh, iroh_debug: iroh::Iroh) -> Self {
        let ticket = iroh.gossip.ticket().to_owned();
        Self {
            iroh_debug,
            iroh,
            files: Mutex::new(files::Files::new(ticket)),
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
