use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Manager};

pub fn file_name_from_path(path: &PathBuf) -> Result<String, String> {
    let name = path
        .file_name()
        .ok_or("Failed to get file name")?
        .to_string_lossy()
        .to_string();
    Ok(name)
}

pub fn get_download_dir(handle: &AppHandle) -> Result<PathBuf, String> {
    let dir = handle
        .path()
        .download_dir()
        .map_err(|_| "Failed to get download directory")?
        .join("sendit");
    Ok(dir)
}

pub struct Debouncer {
    last_emit: Instant,
    interval: Duration,
}

impl Debouncer {
    pub fn new(interval: Duration) -> Self {
        Self {
            last_emit: Instant::now() - interval,
            interval,
        }
    }

    pub fn is_free(&mut self) -> bool {
        let now = Instant::now();
        if now.duration_since(self.last_emit) >= self.interval {
            self.last_emit = now;
            true
        } else {
            false
        }
    }
}
