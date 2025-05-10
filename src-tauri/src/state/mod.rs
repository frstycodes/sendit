use iroh_blobs::ticket::BlobTicket;
use tauri::{AppHandle, Manager};
use tokio::sync::{Mutex, MutexGuard};
use user_data::User;

pub mod user_data;

use crate::files;
use crate::iroh;

#[derive(Debug)]
pub struct AppState {
    #[allow(unused)]
    #[cfg(debug_assertions)]
    pub iroh_debug: iroh::Iroh,

    pub user: Mutex<Option<User>>,
    pub iroh: iroh::Iroh,
    pub files: Mutex<files::Files>,
    pub header_tickets: Mutex<Vec<BlobTicket>>,
}

impl AppState {
    pub fn new(
        user: Option<User>,
        iroh: iroh::Iroh,
        #[cfg(debug_assertions)] iroh_debug: iroh::Iroh,
    ) -> Self {
        let ticket = iroh.gossip.ticket().to_owned();
        Self {
            user: Mutex::new(user),
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

#[tauri::command]
pub async fn get_user(state: State<'_>) -> Result<Option<User>, String> {
    let user = state.user.lock().await;
    Ok(user.clone())
}

#[tauri::command]
pub async fn update_user(state: State<'_>, user: User, app: AppHandle) -> Result<(), String> {
    let cfg_path = crate::utils::get_config_dir(&app)?.join(user_data::CONFIG_FILE_NAME);

    if let Err(e) = user.save(cfg_path) {
        return Err(format!("Failed to save user data: {}", e));
    }

    let mut state_user = state.user.lock().await;
    *state_user = Some(user);

    Ok(())
}

#[tauri::command]
pub fn app_loaded(app: AppHandle) -> bool {
    match app.try_state::<AppState>() {
        None => false,
        _ => true,
    }
}
